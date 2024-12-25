const axios = require("axios");
const puppeteer = require('puppeteer-extra');
const fs = require("fs");
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// Add stealth plugin and use defaults (all tricks to hide puppeteer usage)
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

// Add adblocker plugin to block all ads and trackers (saves bandwidth)
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

const gmgnUrl = 'https://gmgn.ai/sol/address/';
const addresses = [];

const sendLog = (message) => {
    console.log(`[${new Date().toLocaleString()}] ${message}`);
}

const headers = [
    'wallet', 'name', 'unrealizedPnl', 'realizedProfit', 'totalProfit', 
    'balanceUsd', 'position', 'buyAmount', 'buyPrice', 'sellAmount', 
    'sellPrice', 'totalBuyTxn', 'totalSellTxn'
];

const csvWriter = createCsvWriter({
    path: 'result.csv',
    header: headers.map(header => ({ id: header, title: header })),
});

const saveFile = async (token) => {
    await csvWriter.writeRecords([token]);
    sendLog("Data has been written to CSV file");
}

const delay = (min, max) => new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min));

const loadAddresses = () => {
    return new Promise((resolve, reject) => {
        fs.createReadStream('./wallets.csv')
            .pipe(csv())
            .on('data', (row) => {
                addresses.push(row.wallet);
            })
            .on('end', () => {
                sendLog('CSV file successfully processed');
                resolve();
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}

const main = async () => {
    await loadAddresses();

    const browser = await puppeteer.launch({
        headless: false,
        // args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    for (const address of addresses) {
        const page = await browser.newPage();
        await page.goto(gmgnUrl + address, { waitUntil: 'networkidle2', timeout: 60000 });
        sendLog(`Page loaded for address: ${address}`);
        await page.waitForSelector('table', { timeout: 60000 });
        sendLog('Table loaded');
        const tableData = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('table tr'));
            return rows.map(row => {
                const cells = Array.from(row.querySelectorAll('td'));
                return cells.map(cell => cell.innerText.trim());
            });
        });

        for (let i = 0; i < tableData.length; i++) {
            if (tableData[i].length > 0) {
                const tokenData = tableData[i];
                const token = {
                    wallet: address,
                    name: tokenData[0],
                    unrealizedPnl: tokenData[1],
                    realizedProfit: tokenData[2],
                    totalProfit: tokenData[3],
                    balanceUsd: tokenData[4],
                    position: tokenData[5],
                    buyAmount: tokenData[6]?.split('$')[1] ?? '--',
                    buyPrice: tokenData[6]?.split('$')[2] ?? '--',
                    sellAmount: tokenData[7]?.split('$')[1] ?? '--',
                    sellPrice: tokenData[7]?.split('$')[2] ?? '--',
                    totalBuyTxn: tokenData[8]?.split('/')[0] ?? '--',
                    totalSellTxn: tokenData[8]?.split('/')[1] ?? '--',
                };

                if (token.name.toLowerCase() !== 'buy' && token.name.toLowerCase() !== 'sell') {
                    await saveFile(token);
                }
            }
        }

        await page.close();
        await delay(1000, 3000);
    }

    await browser.close();
}

main()
    .then(() => {
        console.log("Starting the process...");
    })
    .catch((error) => {
        console.error(`Error: ${error}`);
    });