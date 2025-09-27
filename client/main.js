// Global variables
let priceChart;
let volumeChart;
let macdChart;
let socket;
let lastPrice = null;

// Chart configuration for all charts
const CHART_COLORS = {
    price: 'rgba(54, 162, 235, 0.5)',
    averageLine: 'rgba(156, 39, 176, 0.85)', 
    volume: 'rgba(75, 192, 192, 0.6)',
    macd: 'rgba(54, 162, 235, 1)',
    macdSignal: 'rgba(255, 99, 132, 1)',
    macdHistogramPositive: 'rgba(75, 192, 192, 0.6)',
    macdHistogramNegative: 'rgba(255, 99, 132, 0.6)',
    candleRed: '#e74c3c',
    candleGreen: '#2ecc71'
};

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Add ApexCharts library dynamically
    loadApexChartsLibrary().then(() => {
        initCharts();
        connectWebSocket();
    }).catch(error => {
        console.error("Failed to load ApexCharts:", error);
        document.getElementById('price-chart').innerHTML = 
            '<div style="text-align:center;padding:30px;color:#e74c3c">Failed to load chart library. Please refresh the page.</div>';
    });

    // Handle window resize events
    window.addEventListener('resize', () => {
        if (priceChart) {
            priceChart.updateOptions({
                chart: {
                    width: '100%'
                }
            });
        }
        if (volumeChart) volumeChart.update();
        if (macdChart) macdChart.update();
    });
});

function loadApexChartsLibrary() {
    return new Promise((resolve, reject) => {
        if (window.ApexCharts) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/apexcharts';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load ApexCharts"));
        document.head.appendChild(script);
    });
}

function initCharts() {
    // Initialize ApexCharts for price chart (candlesticks + moving average line)
    const priceChartEl = document.getElementById('price-chart');
    const priceChartParent = priceChartEl.parentElement;
    
    // Replace the canvas with a div for ApexCharts
    const apexChartDiv = document.createElement('div');
    apexChartDiv.id = 'apexchart-price';
    priceChartParent.replaceChild(apexChartDiv, priceChartEl);
    
    const priceChartOptions = {
        series: [
            {
                name: 'OHLC',
                type: 'candlestick',
                data: []  // Will be populated with OHLC data
            },
            {
                name: 'Average Price',
                type: 'line',
                data: [], // Will be populated with average price data
                color: CHART_COLORS.averageLine,
                lineWidth: 2,
                zIndex: 1000 // Ensure line is drawn on top
            }
        ],
        chart: {
            type: 'line', // Base type is line to allow mixed types
            height: 250,
            toolbar: {
                show: true,
                tools: {
                    download: true,
                    selection: true,
                    zoom: true,
                    zoomin: true,
                    zoomout: true,
                    pan: true,
                    reset: true
                },
                autoSelected: 'zoom'
            },
            animations: {
                enabled: false
            },
            background: 'transparent'
        },
        plotOptions: {
            candlestick: {
                colors: {
                    upward: CHART_COLORS.candleGreen,
                    downward: CHART_COLORS.candleRed
                },
                wick: {
                    useFillColor: true
                }
            }
        },
        stroke: {
            curve: 'smooth',
            width: [1, 2] // First for candlesticks, second for line
        },
        markers: {
            size: [0, 0], // No markers on either series
            hover: {
                size: 3
            }
        },
        legend: {
            show: true,
            position: 'top',
            horizontalAlign: 'right'
        },
        xaxis: {
            type: 'datetime',
            labels: {
                datetimeUTC: false,
                format: 'HH:mm'
            },
            axisBorder: {
                show: true
            },
            axisTicks: {
                show: true
            }
        },
        yaxis: {
            tooltip: {
                enabled: true
            },
            labels: {
                formatter: function(value) {
                    return value.toFixed(2);
                }
            }
        },
        tooltip: {
            enabled: true,
            theme: 'light',
            shared: true,
            x: {
                format: 'HH:mm:ss'
            },
            y: {
                formatter: undefined
            },
            custom: ({seriesIndex, dataPointIndex, w}) => {
                // Show both candlestick and average line data if both exist
                let tooltipContent = '<div class="apexcharts-tooltip-box">';
                
                // Add time
                const time = new Date(w.globals.seriesX[0][dataPointIndex]).toLocaleTimeString();
                tooltipContent += `<div>Time: ${time}</div>`;
                
                // Add candlestick data if available
                if (seriesIndex === 0 || w.globals.seriesCandleO?.[0]?.[dataPointIndex] !== undefined) {
                    const o = w.globals.seriesCandleO[0][dataPointIndex];
                    const h = w.globals.seriesCandleH[0][dataPointIndex];
                    const l = w.globals.seriesCandleL[0][dataPointIndex];
                    const c = w.globals.seriesCandleC[0][dataPointIndex];
                    
                    tooltipContent += `
                    <div>Open: ${o ? o.toFixed(2) : 'N/A'}</div>
                    <div>High: ${h ? h.toFixed(2) : 'N/A'}</div>
                    <div>Low: ${l ? l.toFixed(2) : 'N/A'}</div>
                    <div>Close: ${c ? c.toFixed(2) : 'N/A'}</div>`;
                }
                
                // Add average price if available
                const avgPriceSeries = w.globals.series[1];
                if (avgPriceSeries && avgPriceSeries[dataPointIndex] !== undefined) {
                    const avgPrice = avgPriceSeries[dataPointIndex];
                    tooltipContent += `<div>Average: ${avgPrice.toFixed(2)}</div>`;
                }
                
                tooltipContent += '</div>';
                return tooltipContent;
            }
        },
        grid: {
            borderColor: '#e0e0e0',
            strokeDashArray: 5,
            xaxis: {
                lines: {
                    show: true
                }
            },
            yaxis: {
                lines: {
                    show: true
                }
            }
        }
    };
    
    priceChart = new ApexCharts(document.getElementById('apexchart-price'), priceChartOptions);
    priceChart.render();

    // Initialize volume chart with Chart.js
    const volumeCtx = document.getElementById('volume-chart').getContext('2d');
    volumeChart = new Chart(volumeCtx, {
        type: 'bar',
        data: {
            datasets: [{
                label: 'Volume',
                data: [],
                backgroundColor: CHART_COLORS.volume,
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1,
                parsing: { xAxisKey: 'timestamp', yAxisKey: 'volume' }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'minute',
                        displayFormats: { minute: 'HH:mm' }
                    },
                    title: { display: false }
                },
                y: {
                    beginAtZero: true,
                    title: { display: false }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: context => `Volume: ${context.raw.volume}`
                    }
                }
            }
        }
    });

    // Initialize MACD chart with Chart.js
    const macdCtx = document.getElementById('macd-chart').getContext('2d');
    macdChart = new Chart(macdCtx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'MACD',
                    data: [],
                    borderColor: CHART_COLORS.macd,
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    parsing: { xAxisKey: 'timestamp', yAxisKey: 'macd' }
                },
                {
                    label: 'Signal',
                    data: [],
                    borderColor: CHART_COLORS.macdSignal,
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    parsing: { xAxisKey: 'timestamp', yAxisKey: 'signal' }
                },
                {
                    label: 'Histogram',
                    data: [],
                    backgroundColor: ctx => {
                        const d = ctx.dataset.data[ctx.dataIndex];
                        return d && d.histogram >= 0 ? CHART_COLORS.macdHistogramPositive : CHART_COLORS.macdHistogramNegative;
                    },
                    borderColor: ctx => {
                        const d = ctx.dataset.data[ctx.dataIndex];
                        return d && d.histogram >= 0 ? 'rgba(75, 192, 192, 1)' : 'rgba(255, 99, 132, 1)';
                    },
                    borderWidth: 1,
                    type: 'bar',
                    parsing: { xAxisKey: 'timestamp', yAxisKey: 'histogram' }
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'minute',
                        displayFormats: { minute: 'HH:mm' }
                    },
                    title: { display: false }
                },
                y: {
                    beginAtZero: false,
                    title: { display: false }
                }
            },
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: {
                    callbacks: {
                        label: context => {
                            const label = context.dataset.label || '';
                            const value = context.raw[context.dataset.parsing.yAxisKey];
                            return `${label}: ${value.toFixed(2)}`;
                        }
                    }
                }
            }
        }
    });
}

// Establishes WebSocket connection to server
function connectWebSocket() {
    const wsUrl = 'ws://localhost:8000/ws';
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        console.log("WebSocket connected");
        updateConnectionStatus(true);
        fetchInitialData();
    };

    socket.onmessage = event => {
        const data = JSON.parse(event.data);
        updateCharts(data);
        updateStats(data);
    };

    socket.onclose = () => {
        console.log("WebSocket closed");
        updateConnectionStatus(false);
        setTimeout(connectWebSocket, 5000);
    };

    socket.onerror = error => {
        console.error("WebSocket error:", error);
        updateConnectionStatus(false);
    };
}

// Fetches data via HTTP
function fetchInitialData() {
    fetch('http://localhost:8000/data')
        .then(response => response.json())
        .then(data => {
            updateCharts(data);
            updateStats(data);
        })
        .catch(error => console.error("Initial data error:", error));
}

// Update all charts with new data
function updateCharts(data) {
    if (data.minute_data?.length) {
        // Format data for ApexCharts candlestick
        const ohlcData = data.minute_data.map(item => ({
            x: new Date(item.timestamp),
            y: [
                parseFloat(item.open), 
                parseFloat(item.high), 
                parseFloat(item.low), 
                parseFloat(item.close)
            ]
        }));
        
        // Calculate average price for each data point
        const averagePriceData = data.minute_data.map(item => {
            // Calculate average as (open + high + low + close) / 4
            const avgPrice = (
                parseFloat(item.open) + 
                parseFloat(item.high) + 
                parseFloat(item.low) + 
                parseFloat(item.close)
            ) / 4;
            
            return {
                x: new Date(item.timestamp),
                y: avgPrice
            };
        });
        
        // Update the price chart with both candlesticks and average line
        if (priceChart) {
            priceChart.updateSeries([
                {
                    name: 'OHLC',
                    type: 'candlestick',
                    data: ohlcData
                },
                {
                    name: 'Average Price',
                    type: 'line',
                    data: averagePriceData
                }
            ]);
        }

        // Update volume chart (Chart.js)
        if (volumeChart) {
            volumeChart.data.datasets[0].data = data.minute_data;
            volumeChart.update();
        }
    }

    if (data.macd_data?.length) {
        // Update MACD chart (Chart.js)
        if (macdChart) {
            macdChart.data.datasets[0].data = data.macd_data;
            macdChart.data.datasets[1].data = data.macd_data;
            macdChart.data.datasets[2].data = data.macd_data;
            macdChart.update();
        }
    }
}

// Updates statistics display with latest data
function updateStats(data) {
    if (data.daily_stats) {
        const stats = data.daily_stats;
        
        // Update displayed statistics
        document.getElementById('last-price').textContent = 
            stats.last_price ? formatPrice(stats.last_price) : '--';
        document.getElementById('day-open').textContent = 
            stats.day_open ? formatPrice(stats.day_open) : '--';
        document.getElementById('day-high').textContent = 
            stats.day_high ? formatPrice(stats.day_high) : '--';
        document.getElementById('day-low').textContent = 
            stats.day_low ? formatPrice(stats.day_low) : '--';
        document.getElementById('day-volume').textContent = 
            stats.day_volume ? formatNumber(stats.day_volume) : '--';

        // Color-code the last price based on change
        if (stats.last_price && lastPrice !== null) {
            const el = document.getElementById('last-price');
            if (stats.last_price > lastPrice) {
                el.style.color = '#2ecc71'; // Green for price increase
            } else if (stats.last_price < lastPrice) {
                el.style.color = '#e74c3c'; // Red for price decrease
            }
        }

        lastPrice = stats.last_price;
    }
}
 // Updates connection status indicator
function updateConnectionStatus(connected) {
    const el = document.getElementById('connection-status');
    if (el) {
        el.textContent = connected ? 'Connected' : 'Disconnected';
        el.className = `stat-value ${connected ? 'online' : 'offline'}`;
    }
}

// Utility functions to format price to 2 decimals 
function formatPrice(price) {
    return parseFloat(price).toFixed(2);
}

// Utility function to format numbers with commas
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}