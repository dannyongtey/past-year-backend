# Past Year Scrapper Backend

Backend for MMU Vlib past year paper scrapper. Currently in active development. No pull request accepted at the moment.

## Status

Alpha. Fully working and compatible with front end code. Pull requests accepted at the moment. No known bugs.

## Disclaimer

This project is meant to work only for Multimedia University, Malaysia students, as it scrapes the original library website for past year exam papers.

## Features

- Parallel download: The server initiates multiple connections simultaneously to download files in the shortest time possible.
- Cached download: The server caches downloaded files for 24 hours for performant delivery.
- Zip on the fly: The server zips all the files in their respective folders before sending it to you. Hassle-free download guaranteed!
- Single file download: Want a quick download for a particular ID? It's supported on our server!
- ID Sharing - Downloaded past year papers and want to share it to your friends? Share the given ID so they can download the exact same files as you do!

## Tech Stack

- NodeJS (OsmosisJS, ExpressJS, JSZip)
- Redis

## Setup

To setup, simply run
`npm install`

Install redis server on localhost. Run the redis server at port 6379 without extra authentication.

Setup .env file containing `student_id` and `student_password`.

## Bug Reports

Please open an issue at Github.

## Hire me?

Project looks interesting? Contact me at dannyongtey@gmail.com for job opportunities.
