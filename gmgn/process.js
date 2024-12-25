const fs = require('fs');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const inputFilePath = './result.csv';
const outputFilePath = './processed_result.csv';
const summaryFilePath = './summary_result.csv';

const MIN_PROFIT = 1000;
const MIN_PCT = 100;

const csvWriter = createCsvWriter({
    path: outputFilePath,
    header: [
        { id: 'wallet', title: 'wallet' },
        { id: 'symbol', title: 'symbol' },
        { id: 'realizedCashAmount', title: 'realizedCashAmount' },
        { id: 'realizedROI', title: 'realizedROI' },
        { id: 'unrealizedCashAmount', title: 'unrealizedCashAmount' },
        { id: 'unrealizedROI', title: 'unrealizedROI' }
    ]
});

const summaryWriter = createCsvWriter({
    path: summaryFilePath,
    header: [
        { id: 'wallet', title: 'wallet' },
        { id: 'concatened_inside', title: 'concatened_inside' }
    ]
});

const extractSymbol = (name) => {
    const match = name.match(/([A-Za-z]+)\d+[hd]/);
    return match ? match[1] : name;
}

const extractProfit = (profit) => {
    const match = profit.match(/([+-]?\$[\d,.]+)([+-]\d+\.?\d*%)/);
    if (match) {
        const cashAmount = parseFloat(match[1].replace(/[$,]/g, ''));
        const ROI = parseFloat(match[2].replace('%', ''));
        return { cashAmount, ROI };
    }
    return { cashAmount: parseFloat(profit.replace(/[$,]/g, '')), ROI: 0 };
}

const processFile = async () => {
    const results = [];
    const summary = {};

    fs.createReadStream(inputFilePath)
        .pipe(csv())
        .on('data', (row) => {
            if (row.name.toLowerCase() !== 'buy' && row.name.toLowerCase() !== 'sell') {
                const symbol = extractSymbol(row.name);
                const { cashAmount: realizedCashAmount, ROI: realizedROI } = extractProfit(row.realizedProfit);
                const { cashAmount: unrealizedCashAmount, ROI: unrealizedROI } = extractProfit(row.unrealizedPnl);

                if ((!isNaN(realizedCashAmount) && realizedCashAmount > MIN_PROFIT) ||
                    (!isNaN(unrealizedCashAmount) && unrealizedCashAmount > MIN_PROFIT) ||
                    (!isNaN(realizedROI) && realizedROI > MIN_PCT) ||
                    (!isNaN(unrealizedROI) && unrealizedROI > MIN_PCT)) {
                    results.push({
                        wallet: row.wallet,
                        symbol: symbol,
                        realizedCashAmount: realizedCashAmount,
                        realizedROI: realizedROI,
                        unrealizedCashAmount: unrealizedCashAmount,
                        unrealizedROI: unrealizedROI
                    });

                    if (!summary[row.wallet]) {
                        summary[row.wallet] = new Set();
                    }
                    summary[row.wallet].add(symbol);
                }
            }
        })
        .on('end', async () => {
            await csvWriter.writeRecords(results);
            console.log('Processed data has been written to CSV file');

            const summaryResults = Object.keys(summary).map(wallet => ({
                wallet: wallet,
                concatened_inside: `[${Array.from(summary[wallet]).join(' ')}]`
            }));

            await summaryWriter.writeRecords(summaryResults);
            console.log('Summary data has been written to CSV file');
        })
        .on('error', (error) => {
            console.error(`Error: ${error}`);
        });
}

processFile();