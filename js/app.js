// ============================================
// NetScanner Pro - Main Application
// ============================================

(function() {
    'use strict';

    const scanner = new NetScanner();
    const ui = new UI();

    // Initialize UI
    document.addEventListener('DOMContentLoaded', () => {
        ui.init();
        setupEventListeners();
        autoStartBasicScan();
    });

    function setupEventListeners() {
        // Full Scan
        document.getElementById('btn-full-scan').addEventListener('click', runFullScan);
        
        // Export
        document.getElementById('btn-export').addEventListener('click', () => {
            if (!scanner.results.timestamp) {
                ui.toast('Run a scan first before exporting', 'warning');
                return;
            }
            ui.downloadFile(scanner.exportJSON(), `netscanner-report-${Date.now()}.json`, 'application/json');
            ui.toast('JSON report downloaded', 'success');
        });

        // Individual scan buttons
        document.getElementById('btn-ping-test').addEventListener('click', async () => {
            disableBtn('btn-ping-test');
            ui.setScanStatus(true);
            scanner.onLog = (e) => ui.addLog(e);
            const results = await scanner.scanPing();
            ui.updatePingPage(results);
            ui.updateDashboard(scanner.results);
            ui.setScanStatus(false);
            enableBtn('btn-ping-test');
            ui.toast('Ping test complete', 'success');
        });

        document.getElementById('btn-dns-test').addEventListener('click', async () => {
            disableBtn('btn-dns-test');
            ui.setScanStatus(true);
            scanner.onLog = (e) => ui.addLog(e);
            const results = await scanner.scanDNS();
            ui.updateDNSPage(results);
            ui.updateDashboard(scanner.results);
            ui.setScanStatus(false);
            enableBtn('btn-dns-test');
            ui.toast('DNS test complete', 'success');
        });

        document.getElementById('btn-cdn-test').addEventListener('click', async () => {
            disableBtn('btn-cdn-test');
            ui.setScanStatus(true);
            scanner.onLog = (e) => ui.addLog(e);
            const { cdn, tunnels } = await scanner.scanCDN();
            ui.updateCDNPage(cdn, tunnels);
            ui.setScanStatus(false);
            enableBtn('btn-cdn-test');
            ui.toast('CDN & Tunnel test complete', 'success');
        });

        document.getElementById('btn-port-test').addEventListener('click', async () => {
            disableBtn('btn-port-test');
            ui.setScanStatus(true);
            scanner.onLog = (e) => ui.addLog(e);
            const type = document.getElementById('port-scan-type').value;
            const results = await scanner.scanPorts(type);
            ui.updatePortsPage(results);
            ui.setScanStatus(false);
            enableBtn('btn-port-test');
            ui.toast('Port scan complete', 'success');
        });

        document.getElementById('btn-protocol-test').addEventListener('click', async () => {
            disableBtn('btn-protocol-test');
            ui.setScanStatus(true);
            scanner.onLog = (e) => ui.addLog(e);
            const results = await scanner.scanProtocols();
            ui.updateProtocolsPage(results);
            ui.setScanStatus(false);
            enableBtn('btn-protocol-test');
            ui.toast('Protocol test complete', 'success');
        });

        document.getElementById('btn-vpn-test').addEventListener('click', async () => {
            disableBtn('btn-vpn-test');
            ui.setScanStatus(true);
            scanner.onLog = (e) => ui.addLog(e);
            const results = await scanner.generateVPNAdvice();
            ui.updateVPNPage(results);
            ui.updateDashboard(scanner.results);
            ui.setScanStatus(false);
            enableBtn('btn-vpn-test');
            ui.toast('VPN analysis complete', 'success');
        });

        document.getElementById('btn-speed-test').addEventListener('click', async () => {
            disableBtn('btn-speed-test');
            ui.setScanStatus(true);
            scanner.onLog = (e) => ui.addLog(e);
            const results = await scanner.runSpeedTest();
            ui.updateSpeedPage(results);
            ui.setScanStatus(false);
            enableBtn('btn-speed-test');
            ui.toast('Speed test complete', 'success');
        });

        // Report buttons
        document.getElementById('btn-generate-report').addEventListener('click', () => {
            if (!scanner.results.timestamp) {
                ui.toast('Run a scan first', 'warning');
                return;
            }
            ui.generateReport(scanner.results);
            ui.toast('Report generated', 'success');
        });

        document.getElementById('btn-download-json').addEventListener('click', () => {
            if (!scanner.results.timestamp) { ui.toast('Run a scan first', 'warning'); return; }
            ui.downloadFile(scanner.exportJSON(), `netscanner-${Date.now()}.json`, 'application/json');
            ui.toast('JSON downloaded', 'success');
        });

        document.getElementById('btn-download-csv').addEventListener('click', () => {
            if (!scanner.results.timestamp) { ui.toast('Run a scan first', 'warning'); return; }
            ui.downloadFile(scanner.exportCSV(), `netscanner-${Date.now()}.csv`, 'text/csv');
            ui.toast('CSV downloaded', 'success');
        });

        document.getElementById('btn-download-pdf').addEventListener('click', () => {
            if (!scanner.results.timestamp) { ui.toast('Run a scan first', 'warning'); return; }
            ui.downloadFile(scanner.exportHTMLReport(), `netscanner-report-${Date.now()}.html`, 'text/html');
            ui.toast('HTML Report downloaded', 'success');
        });
    }

    async function autoStartBasicScan() {
        scanner.onLog = (e) => ui.addLog(e);
        try {
            const info = await scanner.scanConnection();
            if (info) {
                ui.updateDashboard(scanner.results);
                ui.updateConnectionPage(info);
                scanner.results.timestamp = new Date().toISOString();
            }
        } catch (e) {
            console.error('Auto scan error:', e);
        }
    }

    async function runFullScan() {
        if (scanner.isScanning) {
            ui.toast('Scan already in progress', 'warning');
            return;
        }

        ui.setScanStatus(true);
        ui.toast('Starting full network scan...', 'info');
        disableBtn('btn-full-scan');

        scanner.onLog = (e) => ui.addLog(e);
        scanner.onProgress = (pct) => {
            // Could update a progress bar here
        };

        const results = await scanner.fullScan();

        // Update all pages
        if (results.connection) ui.updateConnectionPage(results.connection);
        if (results.ping?.length) ui.updatePingPage(results.ping);
        if (results.dns?.length) ui.updateDNSPage(results.dns);
        if (results.cdn?.length) ui.updateCDNPage(results.cdn, results.tunnels);
        if (results.ports?.length) ui.updatePortsPage(results.ports);
        if (results.protocols?.length) ui.updateProtocolsPage(results.protocols);
        if (results.vpn?.providers) ui.updateVPNPage(results.vpn);
        if (results.speed) ui.updateSpeedPage(results.speed);
        ui.updateDashboard(results);

        // Network chart
        if (results.ping?.length) {
            const chartData = results.ping.slice(0, 10);
            const chart = new MiniChart('network-chart', { type: 'bar' });
            chart.setData({
                labels: chartData.map(p => p.countryCode),
                datasets: [{ data: chartData.map(p => p.latency), color: '#00d4ff' }]
            });
        }

        ui.setScanStatus(false);
        enableBtn('btn-full-scan');
        ui.toast('Full scan completed!', 'success');
    }

    function disableBtn(id) {
        const btn = document.getElementById(id);
        if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }
    }

    function enableBtn(id) {
        const btn = document.getElementById(id);
        if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    }
})();