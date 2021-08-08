function nowString(date: Date) {
    return '[' + date.toLocaleString('en-au', {hour12: false}) + ']';
}

export default (...args: any[]) => {
    const date = new Date();
    let s = nowString(date);
    for (const key in args) {
        try {
            s += ' ' + JSON.stringify(args[key]);
        } catch (e) {
            s += ' [INVALID JSON OBJECT]';
        }
    }
    console.log(s);
};
