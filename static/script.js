// --- GLOBAL STATE ---
let currentTableData = [];
let currentPage = 1;
const ROWS_PER_PAGE = 5;
let totalPages = 1;
let tradeSummary = {};
let comparisonSummary = {};


// --- Autocomplete Logic ---
const tickerInput = document.getElementById('ticker-input');
const autocompleteList = document.getElementById('autocomplete-list');
let searchTimeout;

tickerInput.addEventListener('input', () => {
    const query = tickerInput.value;

    clearTimeout(searchTimeout);

    if (query.length < 1) {
        closeAllLists();
        return;
    }

    // Debounce the search
    searchTimeout = setTimeout(async () => {
        try {
            // Note: Uses relative path, assuming Flask app is running the API route
            const response = await fetch(`/api/search_tickers?q=${query}`);
            if (!response.ok) return;

            const items = await response.json();
            buildDropdown(items);
        } catch (e) {
            console.error("Autocomplete fetch error:", e);
        }
    }, 300);
});

function buildDropdown(items) {
    closeAllLists();
    if (items.length === 0) return;

    items.forEach(item => {
        const itemDiv = document.createElement('DIV');
        itemDiv.innerHTML = `<span class="ticker">${item.Ticker}</span> <span class="name">${item.Name}</span>`;

        itemDiv.addEventListener('click', () => {
            tickerInput.value = item.Ticker;
            closeAllLists();
        });
        autocompleteList.appendChild(itemDiv);
    });
}

function closeAllLists() {
    autocompleteList.innerHTML = '';
}

document.addEventListener('click', (e) => {
    if (e.target !== tickerInput) {
        closeAllLists();
    }
});


// --- UTILITY FUNCTIONS ---
//function formatCurrency(value) {
//    if (isNaN(value) || value === null) {
//        return value;
//    }
//    const sign = value < 0 ? '-' : '';
//    return `${sign}$${Math.abs(value).toFixed(2)}`;
//}

function formatCurrency(amount, locale = 'en-US', currency = 'USD') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function formatPercentage(value) {
    if (isNaN(value) || value === null) {
        return value;
    }
    return `${value.toFixed(2)}%`;
}

function getGainLossClass(valueString) {
    if (typeof valueString !== 'string') {
        return 'value-neutral';
    }

    if (valueString === 'N/A') {
        return 'value-neutral';
    }
    // Check for negative sign for dollar or percentage value
    if (valueString.startsWith('-') || valueString.includes('-')) {
        return 'value-loss';
    }
    // Check for zero value
    if (parseFloat(valueString.replace(/[^0-9.-]+/g,"")) === 0) {
         return 'value-neutral';
    }
    return 'value-gain';
}


// --- RENDERING FUNCTIONS ---

function renderComparisonSummary(data) {
    const comparisonDiv = document.getElementById('comparison-summary');
    comparisonDiv.style.display = 'block';

    const initialInvestment = data.initial_sum;
    const target = document.getElementById('growth-target-input').value;
    const investmentPerStrategy = initialInvestment / 2;

    const strat1Gain = data.strategy_1.total_gain;
    const strat1ROI = data.strategy_1.roi;
    const strat2Gain = data.strategy_2.total_gain;
    const strat2ROI = data.strategy_2.roi;

    const totalGain = strat1Gain + strat2Gain;
    const totalROI = (totalGain / initialInvestment) * 100;

    const comparisonHTML = `
        <h2 class="section-title">Strategy Comparison (Initial Sum: ${formatCurrency(initialInvestment)})</h2>
        <p class="summary-item-info">
            Investment split 50/50: ${formatCurrency(investmentPerStrategy)} allocated to each strategy.
            Hybrid strategy profit target: ${target}%.
        </p>
        <div class="comparison-grid">
            <!-- Overall Results Card -->
            <div class="strategy-card" style="background-color: #629bb5; border-color: #60a5fa;">
                <h3>Total Portfolio Gain</h3>
                <div class="metric-item">
                    <span class="metric-label" style="color: #16213e;" >Initial Sum</span>
                    <span class="value-neutral">${formatCurrency(initialInvestment)}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label" style="color: #16213e;">Final Value</span>
                    <span class="${getGainLossClass(formatCurrency(initialInvestment + totalGain))}">${formatCurrency(initialInvestment + totalGain)}</span>
                </div>
                <div class="metric-item" style="border-top: 1px solid #93c5fd; padding-top: 10px; margin-top: 5px;">
                    <span class="metric-label" style="color: #16213e;">**Total Gain/Loss**</span>
                    <span class="${getGainLossClass(formatCurrency(totalGain))}">${formatCurrency(totalGain)}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label" style="color: #16213e;">Total ROI</span>
                    <span class="${getGainLossClass(formatPercentage(totalROI))}">${formatPercentage(totalROI)}</span>
                </div>
            </div>

            <!-- Strategy 1 Card -->
            <div class="strategy-card">
                <h3>Strategy 1: MA Crossover <br>(100% Invest)</h3>
                <div class="metric-item">
                    <span class="metric-label">Investment</span>
                    <span class="value-neutral">${formatCurrency(investmentPerStrategy)}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Final Value</span>
                    <span class="${getGainLossClass(formatCurrency(data.strategy_1.final_value))}">${formatCurrency(data.strategy_1.final_value)}</span>
                </div>
                <div class="metric-item" style="border-top: 1px dashed #f3f4f6; padding-top: 10px; margin-top: 5px;">
                    <span class="metric-label">Total Gain/Loss</span>
                    <span class="${getGainLossClass(formatCurrency(strat1Gain))}">${formatCurrency(strat1Gain)}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Total ROI</span>
                    <span class="${getGainLossClass(formatPercentage(strat1ROI))}">${formatPercentage(strat1ROI)}</span>
                </div>
            </div>

            <!-- Strategy 2 Card -->
            <div class="strategy-card">
                <h3>Strategy 2: Hybrid <br>(50% Target, 50% MA)</h3>
                <div class="metric-item">
                    <span class="metric-label">Investment</span>
                    <span class="value-neutral">${formatCurrency(investmentPerStrategy)}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Final Value</span>
                    <span class="${getGainLossClass(formatCurrency(data.strategy_2.final_value))}">${formatCurrency(data.strategy_2.final_value)}</span>
                </div>
                <div class="metric-item" style="border-top: 1px dashed #f3f4f6; padding-top: 10px; margin-top: 5px;">
                    <span class="metric-label">Total Gain/Loss</span>
                    <span class="${getGainLossClass(formatCurrency(strat2Gain))}">${formatCurrency(strat2Gain)}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Total ROI</span>
                    <span class="${getGainLossClass(formatPercentage(strat2ROI))}">${formatPercentage(strat2ROI)}</span>
                </div>
            </div>
        </div>
    `;

    comparisonDiv.innerHTML = comparisonHTML;
}

function renderTable() {
    const tableContainer = document.getElementById('table-container');
    const data = currentTableData;

    if (data.length === 0) {
         tableContainer.innerHTML = '';
         return;
    }

    const shortHeader = data[0].short_header;
    const longHeader = data[0].long_header;

    totalPages = Math.ceil(data.length / ROWS_PER_PAGE);

    if (currentPage > totalPages) { currentPage = totalPages; }
    if (currentPage < 1) { currentPage = 1; }

    const start = (currentPage - 1) * ROWS_PER_PAGE;
    const end = start + ROWS_PER_PAGE;
    const paginatedData = data.slice(start, end);

    // 1. Build Table HTML
    let tableHTML = `
        <h2 class="section-title">MA Crossover Signals (Historical Trading Points for Strategy 1)</h2>
        <div class="table-scroll">
            <table class="results-table">
                <thead>
                    <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Signal</th>
                        <th scope="col">Closing Price</th>
                        <th scope="col">${shortHeader}</th>
                        <th scope="col">${longHeader}</th>
                        <th scope="col">Gain (Buy to Sell Cycle)</th>
                    </tr>
                </thead>
                <tbody>
    `;
    paginatedData.forEach(row => {

        let gainCellContent = '';
        if (row.signal_type === 'Sell' && row.gain_value !== null) {
            const gainClass = getGainLossClass(row.gain_value);
            gainCellContent = `<span class="${gainClass}">
                                ${row.gain_value} (${row.gain_percent})
                            </span>`;
        }

        tableHTML += `
            <tr>
                <td data-label="Date">${row.date}</td>
                <td data-label="Signal" class="signal-${row.signal_type}">${row.signal_type.toUpperCase()}</td>
                <td data-label="Closing Price">${row.close_price}</td>
                <td data-label="${shortHeader}">${row.short_ma}</td>
                <td data-label="${longHeader}">${row.long_ma}</td>
                <td data-label="Gain">${gainCellContent}</td>
            </tr>
        `;
    });
    tableHTML += '</tbody></table></div>';

    // 2. Build MA Only Summary Section
    if (tradeSummary.total_trades_display > 0) {
        const avgGainClass = getGainLossClass(tradeSummary.average_gain_value);

        tableHTML += `
            <div class="summary-box">
                <h3 class="summary-title">Strategy 1 (MA Only) Trade Metrics (${tradeSummary.total_trades_display} Completed Cycles)</h3>

                <div class="summary-item">
                    <span>Average Gain/Loss per Trade:</span>
                    <span class="${avgGainClass}">
                        ${tradeSummary.average_gain_value} (${tradeSummary.average_gain_percent})
                    </span>
                </div>

                <div class="summary-item">
                    <span>Strategy Effectiveness (Accuracy Rate):</span>
                    <span class="${getGainLossClass(tradeSummary.accuracy_rate_percent)}">
                        ${tradeSummary.accuracy_rate_percent}
                    </span>
                </div>
            </div>
        `;
    } else if (data.length > 0) {
         tableHTML += `<div class="summary-box"><p class="summary-item-info">No completed Buy-to-Sell cycles found for detailed trade metrics.</p></div>`;
    }

    // 3. Build Pagination Controls
    tableHTML += `
        <div id="pagination-controls">
            <button id="prev-btn" onclick="prevPage()">Previous</button>
            <span id="page-info">Page ${currentPage} of ${totalPages} (Total signals: ${data.length})</span>
            <button id="next-btn" onclick="nextPage()">Next</button>
        </div>
    `;

    tableContainer.innerHTML = tableHTML;

    // 4. Update button states
    document.getElementById('prev-btn').disabled = currentPage === 1;
    document.getElementById('next-btn').disabled = currentPage === totalPages;
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderTable();
    }
}

function nextPage() {
    if (currentPage < totalPages) {
        currentPage++;
        renderTable();
    }
}

// Attach pagination functions to window scope
window.prevPage = prevPage;
window.nextPage = nextPage;

// --- MAIN ANALYSIS LOGIC ---
document.getElementById('analyze-btn').addEventListener('click', async () => {
    // 1. Get elements and inputs
    const ticker = document.getElementById('ticker-input').value.toUpperCase();
    const longMaPeriod = document.getElementById('long-ma-input').value;
    const shortMaPeriod = document.getElementById('short-ma-input').value;
    const startDate = document.getElementById('date-input').value;
    const initialSum = document.getElementById('initial-sum-input').value;
    const growthTarget = document.getElementById('growth-target-input').value;

    const loader = document.getElementById('loader');
    const messageContainer = document.getElementById('message-container');
    const chartContainer = document.getElementById('chart-container');
    const tableContainer = document.getElementById('table-container');
    const comparisonDiv = document.getElementById('comparison-summary');

    // 2. Reset UI and state
    loader.style.display = 'block';
    messageContainer.innerHTML = '';
    tableContainer.innerHTML = '';
    comparisonDiv.style.display = 'none';
    Plotly.purge(chartContainer);
    closeAllLists();
    currentTableData = [];
    currentPage = 1;
    tradeSummary = {};
    comparisonSummary = {};

    try {
        // 3. Fetch data from the API endpoint
        const url = new URL('/api/analyze', window.location.origin);
        url.searchParams.append('ticker', ticker);
        url.searchParams.append('long_ma_period', longMaPeriod);
        url.searchParams.append('short_ma_period', shortMaPeriod);
        url.searchParams.append('start_date', startDate);
        url.searchParams.append('initial_sum', initialSum);
        url.searchParams.append('growth_target', growthTarget);

        const response = await fetch(url.toString());
        const data = await response.json();

        if (!response.ok) {
            // Error response from Flask server
            throw new Error(data.error || 'Failed to fetch analysis data.');
        }

        // 4. Store comparison data and render the comparison summary first
        comparisonSummary = {
            initial_sum: data.initial_sum,
            strategy_1: data.strategy_1,
            strategy_2: data.strategy_2
        };
        renderComparisonSummary(data);

        // 5. Store table data and render the signals table
        if (data.table_data.length > 0) {
            currentTableData = data.table_data;
            tradeSummary = {
                average_gain_value: data.average_gain_value,
                average_gain_percent: data.average_gain_percent,
                total_trades_display: data.total_trades_display,
                accuracy_rate_percent: data.accuracy_rate_percent
            };
            renderTable();
            messageContainer.innerHTML = `<div class="message message-success">Analysis complete for ${ticker}.</div>` + messageContainer.innerHTML;
        } else {
            messageContainer.innerHTML = `<div class="message message-info">No crossover signals found for ${ticker} since ${startDate}. Strategy simulations rely on these signals.</div>`;
        }


        // 6. Build Plotly Chart
        const traceClose = { x: data.dates, y: data.close_prices, type: 'scatter', mode: 'lines', name: 'Closing Price', line: { color: '#1f77b4', width: 1.5 } };
        const traceLongMA = { x: data.dates, y: data.long_ma_prices, type: 'scatter', mode: 'lines', name: `${data.long_ma_period} Week MA`, line: { color: '#ff7f0e', width: 2, dash: 'solid' } };
        const traceShortMA = { x: data.dates, y: data.short_ma_prices, type: 'scatter', mode: 'lines', name: `${data.short_ma_period} Day MA`, line: { color: '#2ca02c', width: 1.5, dash: 'dot' } };
        const traceBuy = { x: data.buy_signal_dates, y: data.buy_signal_prices, type: 'scatter', mode: 'markers', name: 'Buy Signal', marker: { color: 'green', symbol: 'triangle-up', size: 10 } };
        const traceSell = { x: data.sell_signal_dates, y: data.sell_signal_prices, type: 'scatter', mode: 'markers', name: 'Sell Signal', marker: { color: 'red', symbol: 'triangle-down', size: 10 } };

        const layout = {
            title: `${ticker} Stock Price and MA Crossover Analysis`,
            xaxis: { title: 'Date' },
            yaxis: { title: 'Price (USD)' },
            hovermode: 'x unified',
            legend: { orientation: 'h', y: -0.2, x: 0.5, xanchor: 'center' },
            margin: { l: 50, r: 20, t: 60, b: 100 }
        };

        Plotly.newPlot('chart-container', [traceClose, traceLongMA, traceShortMA, traceBuy, traceSell], layout, {
            responsive: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['select2d', 'lasso2d'],
        });


    } catch (error) {
        // 7. Handle Errors
        console.error('Analysis Error:', error);
        messageContainer.innerHTML = `<div class="message message-error">Analysis Failed: ${error.message}</div>`;
    } finally {
        // 8. Hide loader
        loader.style.display = 'none';
    }
});
