const axios = require('axios');
const zlib = require('zlib');
const parseXML = require('xml2js').parseStringPromise;
const fs = require('fs').promises;

const gunzip = (data) => new Promise((resolve, reject) => {
    zlib.gunzip(data, (err, result) => {
        if(err) {
            return reject(err);
        }
        resolve(result);
    });
});

const minuteURL = 'https://planet.openstreetmap.org/replication/minute/'

// Australia bounds
const bounds = {
    top: -9.088013,
    bottom: -44.5904672,
    left: 112.5878906,
    right: 154.5117188,
};

const pad3 = (n) => String(n).padStart(3, '0');

const getURLForSequenceNumber = (id) => {
    const f1 = pad3(Math.floor(id / 1000000));
    const f2 = pad3(Math.floor((id / 1000) % 1000));
    const f3 = pad3(Math.floor(id % 1000));
    return `${minuteURL}${f1}/${f2}/${f3}.osc.gz`;
};

const inBounds = (lat, lon) => lat < bounds.top && lat > bounds.bottom && lon < bounds.right && lon > bounds.left;

const filterNodesToChangeset = (filtered, nodes) => {
    if(nodes.node) {
        for(let i = 0; i < nodes.node.length; i++) {
            const nodeData = nodes.node[i].$;
            if(inBounds(nodeData.lat, nodeData.lon)) {
                return new Set([...filtered, nodeData.changeset]);
            }
        }
    }
    return filtered;
};

const getChangesetDetails = (id) => {
    return axios.get(`https://www.openstreetmap.org/api/0.6/changeset/${id}`).then(response => {
        const element = response.data.elements[0];
        return {
            user: element.user,
            comment: element.tags.comment === undefined ? null : element.tags.comment,
        };
    });
};

const getSequenceData = (sequenceNumber) => {
    const url = getURLForSequenceNumber(sequenceNumber);
    return axios.get(url, { responseType: 'arraybuffer' }).then(res => {
        return gunzip(res.data).then((result) => {
            return parseXML(result.toString('utf8'));
        });
    });
};

const getBoundedChangesetsFromSequenceXML = (xml) => {
    let filteredChangesets = new Set();
    if(xml.osmChange.create) {
        filteredChangesets = xml.osmChange.create.reduce(filterNodesToChangeset, filteredChangesets);
    }
    if(xml.osmChange.modify) {
        filteredChangesets = xml.osmChange.modify.reduce(filterNodesToChangeset, filteredChangesets);
    }
    if(xml.osmChange.delete) {
        filteredChangesets = xml.osmChange.delete.reduce(filterNodesToChangeset, filteredChangesets);
    }
    const changesetDetails = [...filteredChangesets].map(getChangesetDetails);
    return Promise.all(changesetDetails);
}

const getLatestSequenceNumber = () => {
    return axios.get(`${minuteURL}state.txt`).then((response) => {
        return response.data.match(/sequenceNumber=(\d+)/)[1];
    });
}

const process = (sequenceNumber) => {
    return getSequenceData(sequenceNumber).then(getBoundedChangesetsFromSequenceXML).then(console.log);
}

const promiseLoop = (getNext) => {
    const next = getNext();
    if(next) {
        return next.then((doContinue) => {
            if(doContinue) {
                return promiseLoop(getNext);
            }
        });
    }
}

const processFromTo = (start, end) => new Promise((resolve) => {
    let current = start;
    return promiseLoop(() => {
        const next = String(current);
        current++;
        if(next <= end) {
            console.log(`Processing ${next}`);
            return process(next);
        } else {
            resolve(end);
        }
    });
});

const settingsFile = './settings.json';
fs.readFile(settingsFile)
    .then(JSON.parse)
    .then(settings => {
        return getLatestSequenceNumber().then(latestSequenceNumber => {
            return processFromTo(parseInt(settings.last), parseInt(latestSequenceNumber))
                .then(lastProcessed => {
                    return fs.writeFile(settingsFile, JSON.stringify({last: String(lastProcessed)}, null, 4));
                });
        });
    });
