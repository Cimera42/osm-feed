# OSM Feed - Discord

I tried to find a resource that would notify of Open Street Maps changes in a specific region and was not able to find one that could encompass the entirety of Australia.
This project tracks the changes made and sends messages to a Discord channel when they are made in a specific region.

# How it Works

1. Every minute, it downloads the latest changes from https://planet.openstreetmap.org/replication/minute/.
2. Parses all changes
3. Finds changes that are within the bounds of a specified country
4. Sends a message to a Discord webhook for each change

If it ever goes down and is restarted, it will resume at the last set of changes it checked and run until it reaches the present, upon which it will run periodically as per usual.

# How to set up and customise

To run:

1. Run `yarn install`
2. Duplicate `settings.template.json` and rename to `settings.json`
3. Add Discord webhook url to `settings.json` as `webhookUrl`
4. Run `yarn start bounds <country>` to generate a boundary of the country to watch. \
   e.g. `yarn start bounds Australia`
5. Run `yarn start feed`

# Example Discord Messages

![image](./assets/screenshot.png)

# Development

### Notebooks

This repository also contains some Jupyter python notebooks which were used for investigation of various aspects of the project. Follow the [instructions on installing Jupyter Notebook](https://jupyter.org/install#getting-started-with-the-classic-jupyter-notebook) to view and run them. There is not currently a list of the packages required to run these notebooks, but this may be added at a later date.
