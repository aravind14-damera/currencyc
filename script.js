const API_BASE_URL = 'https://api.frankfurter.app';
let currencies = [];
let chart = null;
let favoritesCurrency = [];
let conversionHistory = [];
let updateInterval = null;

// DOM Loaded
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Fetch available currencies
        await fetchCurrencies();
        
        // Set current date as default end date and 30 days before as start date
        setDefaultDates();
        
        // Load saved data
        loadFavorites();
        loadConversionHistory();
        
        // Set up event listeners
        setupEventListeners();
        
        // Start real-time updates
        startRealTimeUpdates();
        
        // Update last updated time
        updateLastUpdatedTime();
        
        // Show default tab
        document.querySelector('.nav-link[href="#converter"]').click();
    } catch (error) {
        showAlert(`Failed to initialize app: ${error.message}`, 'danger');
    }
});

// Fetch available currencies
async function fetchCurrencies() {
    try {
        const response = await fetch(`${API_BASE_URL}/currencies`);
        const data = await response.json();
        
        currencies = Object.entries(data).map(([code, name]) => ({ code, name }));
        
        // Populate currency dropdowns
        populateCurrencyDropdowns();
    } catch (error) {
        showAlert(`Failed to fetch currencies: ${error.message}`, 'danger');
    }
}

// Populate currency dropdowns
function populateCurrencyDropdowns() {
    const dropdowns = [
        'fromCurrency', 
        'toCurrency', 
        'historicalFromCurrency', 
        'historicalToCurrency',
        'specificDateFrom',
        'specificDateTo',
        'multiFromCurrency',
        'multiToCurrency',
        'allRatesBase'
    ];
    
    dropdowns.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        
        // Clear existing options
        select.innerHTML = '';
        
        // Add options
        currencies.forEach(currency => {
            const option = document.createElement('option');
            option.value = currency.code;
            option.textContent = `${currency.code} - ${currency.name}`;
            select.appendChild(option);
        });
        
        // Set default values
        if (id === 'fromCurrency' || id === 'historicalFromCurrency' || id === 'specificDateFrom' || 
            id === 'multiFromCurrency' || id === 'allRatesBase') {
            select.value = 'EUR';
        } else if (id === 'toCurrency' || id === 'historicalToCurrency' || id === 'specificDateTo') {
            select.value = 'USD';
        }
    });
}

// Set default dates
function setDefaultDates() {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    document.getElementById('endDate').valueAsDate = today;
    document.getElementById('startDate').valueAsDate = thirtyDaysAgo;
    document.getElementById('specificDate').valueAsDate = today;
}

// Setup event listeners
function setupEventListeners() {
    // Basic Converter
    document.getElementById('converterForm').addEventListener('submit', handleConversion);
    document.getElementById('swapCurrencies').addEventListener('click', swapCurrencies);
    document.getElementById('addToFavorites').addEventListener('click', addToFavorites);
    
    // Historical Rates
    document.getElementById('historicalForm').addEventListener('submit', handleHistoricalRates);
    
    // Date Finder
    document.getElementById('dateFinder').addEventListener('submit', handleDateFinder);
    
    // Multi-Currency Conversion
    document.getElementById('multiCurrencyForm').addEventListener('submit', handleMultiCurrencyConversion);
    
    // All Rates
    document.getElementById('getAllRates').addEventListener('click', handleGetAllRates);
    
    // Clear History
    document.getElementById('clearHistory').addEventListener('click', clearConversionHistory);
    
    // Dark Mode Toggle
    document.getElementById('darkModeToggle').addEventListener('change', toggleDarkMode);
    
    // Navigation Links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all links
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            this.classList.add('active');
            
            // Hide all sections
            document.querySelectorAll('section').forEach(section => {
                section.style.display = 'none';
            });
            
            // Show the target section
            const targetId = this.getAttribute('href').substring(1);
            document.getElementById(targetId).style.display = 'block';
        });
    });
}

// Handle basic conversion
async function handleConversion(e) {
    e.preventDefault();
    
    const amount = parseFloat(document.getElementById('amount').value);
    const fromCurrency = document.getElementById('fromCurrency').value;
    const toCurrency = document.getElementById('toCurrency').value;
    
    if (isNaN(amount) || amount <= 0) {
        showAlert('Please enter a valid amount greater than 0', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/latest?amount=${amount}&from=${fromCurrency}&to=${toCurrency}`);
        const data = await response.json();
        
        const result = data.rates[toCurrency];
        const rate = result / amount;
        
        document.getElementById('conversionResult').innerHTML = `
            <div class="alert alert-success">
                ${amount.toFixed(2)} ${fromCurrency} = <strong>${result.toFixed(2)} ${toCurrency}</strong>
                <br>
                <small>Rate: 1 ${fromCurrency} = ${rate.toFixed(6)} ${toCurrency}</small>
            </div>
        `;
        
        // Add to conversion history
        addToConversionHistory(fromCurrency, toCurrency, amount, result, rate);
    } catch (error) {
        showAlert(`Conversion failed: ${error.message}`, 'danger');
    }
}

// Swap currencies
function swapCurrencies() {
    const fromCurrency = document.getElementById('fromCurrency');
    const toCurrency = document.getElementById('toCurrency');
    
    const temp = fromCurrency.value;
    fromCurrency.value = toCurrency.value;
    toCurrency.value = temp;
}

// Handle historical rates
async function handleHistoricalRates(e) {
    e.preventDefault();
    
    const fromCurrency = document.getElementById('historicalFromCurrency').value;
    const toCurrency = document.getElementById('historicalToCurrency').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (!startDate || !endDate) {
        showAlert('Please select start and end dates', 'warning');
        return;
    }
    
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    
    if (startDateObj > endDateObj) {
        showAlert('Start date cannot be after end date', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/${startDate}..${endDate}?from=${fromCurrency}&to=${toCurrency}`);
        const data = await response.json();
        
        // Process the data
        const ratesData = processRates(data, toCurrency);
        
        // Update summary
        updateHistoricalSummary(ratesData, fromCurrency, toCurrency);
        
        // Display chart
        displayChart(ratesData, fromCurrency, toCurrency);
        
        // Populate table
        populateHistoricalTable(ratesData, fromCurrency, toCurrency);
    } catch (error) {
        showAlert(`Failed to fetch historical data: ${error.message}`, 'danger');
    }
}

// Process rates data
function processRates(data, toCurrency) {
    const ratesData = [];
    let previousRate = null;
    
    Object.entries(data.rates).forEach(([date, rates]) => {
        const rate = rates[toCurrency];
        const change = previousRate ? ((rate - previousRate) / previousRate) * 100 : 0;
        
        ratesData.push({
            date,
            rate,
            change
        });
        
        previousRate = rate;
    });
    
    return ratesData;
}

// Update historical summary
function updateHistoricalSummary(ratesData, fromCurrency, toCurrency) {
    // Calculate percentage change from first to last
    const firstRate = ratesData[0].rate;
    const lastRate = ratesData[ratesData.length - 1].rate;
    const percentageChange = ((lastRate - firstRate) / firstRate) * 100;
    
    // Find highest and lowest rates
    const highestRate = Math.max(...ratesData.map(d => d.rate));
    const lowestRate = Math.min(...ratesData.map(d => d.rate));
    
    const highestRateData = ratesData.find(d => d.rate === highestRate);
    const lowestRateData = ratesData.find(d => d.rate === lowestRate);
    
    // Find day with highest fluctuation
    let highestFluctuationDay = null;
    let highestFluctuation = 0;
    
    for (let i = 1; i < ratesData.length; i++) {
        const absChange = Math.abs(ratesData[i].rate - ratesData[i-1].rate);
        if (absChange > highestFluctuation) {
            highestFluctuation = absChange;
            highestFluctuationDay = ratesData[i];
        }
    }
    
    // Update the summary
    document.getElementById('percentageChange').innerHTML = `
        <span class="${percentageChange >= 0 ? 'positive-change' : 'negative-change'}">
            ${percentageChange.toFixed(2)}%
            ${percentageChange >= 0 ? '▲' : '▼'}
        </span>
        <br>
        <small>${fromCurrency} to ${toCurrency}</small>
    `;
    
    document.getElementById('highestRate').innerHTML = `
        ${highestRate.toFixed(6)}
        <br>
        <small>on ${new Date(highestRateData.date).toLocaleDateString()}</small>
    `;
    
    document.getElementById('lowestRate').innerHTML = `
        ${lowestRate.toFixed(6)}
        <br>
        <small>on ${new Date(lowestRateData.date).toLocaleDateString()}</small>
    `;
    
    document.getElementById('highestFluctuation').innerHTML = `
        ${highestFluctuationDay ? new Date(highestFluctuationDay.date).toLocaleDateString() : '-'}
        <br>
        <small>${highestFluctuation.toFixed(6)} ${toCurrency}</small>
    `;
}

// Display chart
function displayChart(ratesData, fromCurrency, toCurrency) {
    const ctx = document.getElementById('rateChart').getContext('2d');
    
    // Destroy previous chart if it exists
    if (chart) {
        chart.destroy();
    }
    
    // Prepare data for the chart
    const labels = ratesData.map(d => new Date(d.date).toLocaleDateString());
    const rates = ratesData.map(d => d.rate);
    
    // Create new chart
    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: `${fromCurrency} to ${toCurrency} Exchange Rate`,
                data: rates,
                backgroundColor: rates.map((rate, index) => {
                    if (index === 0) return 'rgba(54, 162, 235, 0.6)';
                    return ratesData[index].change >= 0 ? 'rgba(75, 192, 192, 0.6)' : 'rgba(255, 99, 132, 0.6)';
                }),
                borderColor: rates.map((rate, index) => {
                    if (index === 0) return 'rgba(54, 162, 235, 1)';
                    return ratesData[index].change >= 0 ? 'rgba(75, 192, 192, 1)' : 'rgba(255, 99, 132, 1)';
                }),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false
                }
            }
        }
    });
}

// Populate historical table
function populateHistoricalTable(ratesData, fromCurrency, toCurrency) {
    const tableBody = document.getElementById('historicalRatesTable').querySelector('tbody');
    tableBody.innerHTML = '';
    
    // Identify day with highest fluctuation
    let highestFluctuationDate = null;
    let highestFluctuation = 0;
    
    for (let i = 1; i < ratesData.length; i++) {
        const absChange = Math.abs(ratesData[i].rate - ratesData[i-1].rate);
        if (absChange > highestFluctuation) {
            highestFluctuation = absChange;
            highestFluctuationDate = ratesData[i].date;
        }
    }
    
    ratesData.forEach(data => {
        const row = document.createElement('tr');
        
        // Highlight day with highest fluctuation
        if (data.date === highestFluctuationDate) {
            row.classList.add('fluctuation-day');
        }
        
        row.innerHTML = `
            <td>${new Date(data.date).toLocaleDateString()}</td>
            <td>${data.rate.toFixed(6)}</td>
            <td class="${data.change >= 0 ? 'positive-change' : 'negative-change'}">
                ${data.change.toFixed(2)}%
                ${data.change >= 0 ? '▲' : '▼'}
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Handle date finder
async function handleDateFinder(e) {
    e.preventDefault();
    
    const fromCurrency = document.getElementById('specificDateFrom').value;
    const toCurrency = document.getElementById('specificDateTo').value;
    const specificDate = document.getElementById('specificDate').value;
    
    if (!specificDate) {
        showAlert('Please select a date', 'warning');
        return;
    }
    
    try {
        // Get rate for specific date
        const specificResponse = await fetch(`${API_BASE_URL}/${specificDate}?from=${fromCurrency}&to=${toCurrency}`);
        const specificData = await specificResponse.json();
        
        // Get latest rate
        const latestResponse = await fetch(`${API_BASE_URL}/latest?from=${fromCurrency}&to=${toCurrency}`);
        const latestData = await latestResponse.json();
        
        const specificRate = specificData.rates[toCurrency];
        const latestRate = latestData.rates[toCurrency];
        
        // Calculate percentage difference
        const difference = ((latestRate - specificRate) / specificRate) * 100;
        
        document.getElementById('specificDateResult').innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h5>Exchange Rate on ${new Date(specificDate).toLocaleDateString()}</h5>
                    <p class="display-6">1 ${fromCurrency} = ${specificRate.toFixed(6)} ${toCurrency}</p>
                </div>
                <div class="col-md-6">
                    <h5>Latest Exchange Rate</h5>
                    <p class="display-6">1 ${fromCurrency} = ${latestRate.toFixed(6)} ${toCurrency}</p>
                    <p class="${difference >= 0 ? 'positive-change' : 'negative-change'}">
                        ${Math.abs(difference).toFixed(2)}% ${difference >= 0 ? 'higher' : 'lower'} than selected date
                        ${difference >= 0 ? '▲' : '▼'}
                    </p>
                </div>
            </div>
        `;
    } catch (error) {
        showAlert(`Failed to fetch data: ${error.message}`, 'danger');
    }
}

// Handle multi-currency conversion
async function handleMultiCurrencyConversion(e) {
    e.preventDefault();
    
    const amount = parseFloat(document.getElementById('multiAmount').value);
    const fromCurrency = document.getElementById('multiFromCurrency').value;
    const toSelect = document.getElementById('multiToCurrency');
    const selectedCurrencies = Array.from(toSelect.selectedOptions).map(option => option.value);
    
    if (isNaN(amount) || amount <= 0) {
        showAlert('Please enter a valid amount greater than 0', 'warning');
        return;
    }
    
    if (selectedCurrencies.length === 0) {
        showAlert('Please select at least one target currency', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/latest?amount=${amount}&from=${fromCurrency}&to=${selectedCurrencies.join(',')}`);
        const data = await response.json();
        
        const tableBody = document.getElementById('multiCurrencyResultTable').querySelector('tbody');
        tableBody.innerHTML = '';
        
        Object.entries(data.rates).forEach(([currency, convertedAmount]) => {
            const rate = convertedAmount / amount;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${currency} - ${currencies.find(c => c.code === currency)?.name || currency}</td>
                <td>${rate.toFixed(6)}</td>
                <td>${convertedAmount.toFixed(2)}</td>
            `;
            
            tableBody.appendChild(row);
            
            // Add to conversion history
            addToConversionHistory(fromCurrency, currency, amount, convertedAmount, rate);
        });
    } catch (error) {
        showAlert(`Conversion failed: ${error.message}`, 'danger');
    }
}

// Add to favorites
function addToFavorites() {
    const fromCurrency = document.getElementById('fromCurrency').value;
    const toCurrency = document.getElementById('toCurrency').value;
    
    // Check if already in favorites
    const existingIndex = favoritesCurrency.findIndex(
        f => f.from === fromCurrency && f.to === toCurrency
    );
    
    if (existingIndex !== -1) {
        showAlert('This currency pair is already in your favorites', 'info');
        return;
    }
    
    favoritesCurrency.push({
        from: fromCurrency,
        to: toCurrency
    });
    
    // Save to localStorage
    localStorage.setItem('favorites', JSON.stringify(favoritesCurrency));
    
    // Update the favorites table
    updateFavoritesTable();
    
    showAlert('Currency pair added to favorites', 'success');
}

// Load favorites from localStorage
function loadFavorites() {
    const saved = localStorage.getItem('favorites');
    
    if (saved) {
        favoritesCurrency = JSON.parse(saved);
        updateFavoritesTable();
    }
}

// Update favorites table
async function updateFavoritesTable() {
    const tableBody = document.getElementById('favoritesTable').querySelector('tbody');
    tableBody.innerHTML = '';
    
    const noFavoritesAlert = document.getElementById('noFavorites');
    
    if (favoritesCurrency.length === 0) {
        noFavoritesAlert.style.display = 'block';
        return;
    }
    
    noFavoritesAlert.style.display = 'none';
    
    // Get latest rates for all favorites
    for (const pair of favoritesCurrency) {
        try {
            const response = await fetch(`${API_BASE_URL}/latest?from=${pair.from}&to=${pair.to}`);
            const data = await response.json();
            
            const rate = data.rates[pair.to];
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${pair.from} - ${currencies.find(c => c.code === pair.from)?.name || pair.from}</td>
                <td>${pair.to} - ${currencies.find(c => c.code === pair.to)?.name || pair.to}</td>
                <td>${rate.toFixed(6)}</td>
                <td>
                    <button class="btn btn-sm btn-primary convert-favorite" data-from="${pair.from}" data-to="${pair.to}">Convert</button>
                    <button class="btn btn-sm btn-danger remove-favorite" data-from="${pair.from}" data-to="${pair.to}">Remove</button>
                </td>
            `;
            
            tableBody.appendChild(row);
        } catch (error) {
            console.error(`Failed to fetch rate for ${pair.from} to ${pair.to}:`, error);
        }
    }
    
    // Add event listeners to buttons
    document.querySelectorAll('.convert-favorite').forEach(button => {
        button.addEventListener('click', handleConvertFavorite);
    });
    
    document.querySelectorAll('.remove-favorite').forEach(button => {
        button.addEventListener('click', handleRemoveFavorite);
    });
}

// Handle convert favorite
function handleConvertFavorite(e) {
    const fromCurrency = e.target.getAttribute('data-from');
    const toCurrency = e.target.getAttribute('data-to');
    
    // Set the values in the main converter
    document.getElementById('fromCurrency').value = fromCurrency;
    document.getElementById('toCurrency').value = toCurrency;
    
    // Navigate to converter tab
    document.querySelector('.nav-link[href="#converter"]').click();
}

// Handle remove favorite
function handleRemoveFavorite(e) {
    const fromCurrency = e.target.getAttribute('data-from');
    const toCurrency = e.target.getAttribute('data-to');
    
    favoritesCurrency = favoritesCurrency.filter(
        f => !(f.from === fromCurrency && f.to === toCurrency)
    );
    
    // Save to localStorage
    localStorage.setItem('favorites', JSON.stringify(favoritesCurrency));
    
    // Update the favorites table
    updateFavoritesTable();
    
    showAlert('Currency pair removed from favorites', 'info');
}

// Handle get all rates
async function handleGetAllRates() {
    const baseCurrency = document.getElementById('allRatesBase').value;
    
    try {
        const response = await fetch(`${API_BASE_URL}/latest?from=${baseCurrency}`);
        const data = await response.json();
        
        const tableBody = document.getElementById('allRatesTable').querySelector('tbody');
        tableBody.innerHTML = '';
        
        Object.entries(data.rates).forEach(([currency, rate]) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${currency} - ${currencies.find(c => c.code === currency)?.name || currency}</td>
                <td>${rate.toFixed(6)}</td>
            `;
            
            tableBody.appendChild(row);
        });
    } catch (error) {
        showAlert(`Failed to fetch rates: ${error.message}`, 'danger');
    }
}

// Add to conversion history
function addToConversionHistory(fromCurrency, toCurrency, amount, result, rate) {
    const historyItem = {
        timestamp: new Date().toISOString(),
        from: fromCurrency,
        to: toCurrency,
        amount,
        result,
        rate
    };
    
    conversionHistory.push(historyItem);
    
    // Save to localStorage
    localStorage.setItem('conversionHistory', JSON.stringify(conversionHistory));
    
    // Update the history table
    updateHistoryTable();
}

// Load conversion history from localStorage
function loadConversionHistory() {
    const saved = localStorage.getItem('conversionHistory');
    
    if (saved) {
        conversionHistory = JSON.parse(saved);
        updateHistoryTable();
    }
}

// Update history table
function updateHistoryTable() {
    const tableBody = document.getElementById('historyTable').querySelector('tbody');
    tableBody.innerHTML = '';
    
    const noHistoryAlert = document.getElementById('noHistory');
    
    if (conversionHistory.length === 0) {
        noHistoryAlert.style.display = 'block';
        document.getElementById('clearHistory').style.display = 'none';
        return;
    }
    
    noHistoryAlert.style.display = 'none';
    document.getElementById('clearHistory').style.display = 'block';
    
    // Sort by timestamp (newest first)
    conversionHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    conversionHistory.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${new Date(item.timestamp).toLocaleString()}</td>
            <td>${item.from}</td>
            <td>${item.to}</td>
            <td>${item.amount.toFixed(2)}</td>
            <td>${item.result.toFixed(2)}</td>
            <td>${item.rate.toFixed(6)}</td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Clear conversion history
function clearConversionHistory() {
    if (confirm('Are you sure you want to clear your conversion history?')) {
        conversionHistory = [];
        localStorage.removeItem('conversionHistory');
        updateHistoryTable();
        showAlert('Conversion history cleared', 'info');
    }
}

// Toggle dark mode
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    
    // Save preference to localStorage
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
}

// Load dark mode preference
function loadDarkModePreference() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        document.getElementById('darkModeToggle').checked = true;
    }
}

// Show alert message
function showAlert(message, type) {
    const alertsContainer = document.getElementById('alerts-container');
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.role = 'alert';
    
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    alertsContainer.appendChild(alert);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        alert.classList.remove('show');
        setTimeout(() => {
            alertsContainer.removeChild(alert);
        }, 150);
    }, 5000);
}

// Start real-time updates
function startRealTimeUpdates() {
    // Update every 60 seconds
    updateInterval = setInterval(async () => {
        // Update favorites table
        if (favoritesCurrency.length > 0) {
            await updateFavoritesTable();
        }
        
        // Update last updated time
        updateLastUpdatedTime();
    }, 60000);
}

// Update last updated time
function updateLastUpdatedTime() {
    const now = new Date();
    document.getElementById('lastUpdated').textContent = now.toLocaleTimeString();
}

// Call loadDarkModePreference when DOM loaded
document.addEventListener('DOMContentLoaded', function() {
    loadDarkModePreference();
});