// ============================================
// NetScanner Pro - UI Management
// ============================================

class UI {
    constructor() {
        this.currentPage = 'dashboard';
        this.sidebar = document.getElementById('sidebar');
        this.pageTitle = document.getElementById('page-title');
        this.scanStatus = document.getElementById('scan-status');
        this.scanLog = document.getElementById('scan-log');
    }

    init() {
        this.setupNavigation();
        this.setupSidebar();
        this.hideLoadingScreen();
    }

    // ===================== LOADING SCREEN =====================
    hideLoadingScreen() {
        const loader = document.getElementById('loading-screen');
        const bar = document.getElementById('loader-bar');
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 30 + 10;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                setTimeout(() => {
                    loader.classList.add('hidden');
                }, 400);
            }
            bar.style.width = progress + '%';
        }, 200);
    }

    // ===================== NAVIGATION =====================
    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.navigateTo(page);
                // Close mobile sidebar
                this.sidebar.classList.remove('mobile-open');
            });
        });
    }

    navigateTo(page) {
        // Update nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        // Update pages
        document.querySelectorAll('.page').forEach(p => {
            p.classList.remove('active');
        });
        const pageEl = document.getElementById('page-' + page);
        if (pageEl) pageEl.classList.add('active');

        // Update title
        const titles = {
            dashboard: 'Dashboard',
            connection: 'Connection Information',
            ping: 'Global Ping Test',
            dns: 'DNS Analysis',
            cdn: 'CDN & Tunnels',
            ports: 'Port Scanner',
            protocols: 'Protocol Analysis',
            vpn: 'VPN Advisor',
            speed: 'Speed Test',
            report: 'Full Report'
        };
        this.pageTitle.textContent = titles[page] || 'Dashboard';
        this.currentPage = page;
    }

    // ===================== SIDEBAR =====================
    setupSidebar() {
        const toggle = document.getElementById('sidebar-toggle');
        const mobileBtn = document.getElementById('mobile-menu-btn');

        if (toggle) {
            toggle.addEventListener('click', () => {
                this.sidebar.classList.toggle('collapsed');
            });
        }

        if (mobileBtn) {
            mobileBtn.addEventListener('click', () => {
                this.sidebar.classList.toggle('mobile-open');
            });
        }

        // Close mobile sidebar on outside click
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 &&
                !this.sidebar.contains(e.target) &&
                !e.target.closest('#mobile-menu-btn')) {
                this.sidebar.classList.remove('mobile-open');
            }
        });
    }

    // ===================== SCAN STATUS =====================
    setScanStatus(scanning) {
        if (scanning) {
            this.scanStatus.classList.add('scanning');
            this.scanStatus.querySelector('.status-text').textContent = 'Scanning...';
        } else {
            this.scanStatus.classList.remove('scanning');
            this.scanStatus.querySelector('.status-text').textContent = 'Ready';
        }
    }

    // ===================== LOG =====================
    addLog(entry) {
        const div = document.createElement('div');
        div.className = `log-entry ${entry.type}`;
        div.innerHTML = `<span class="log-time">${entry.time}</span><span class="log-msg">${entry.msg}</span>`;
        this.scanLog.appendChild(div);
        this.scanLog.scrollTop = this.scanLog.scrollHeight;
    }

    // ===================== TOAST =====================
    toast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="${icons[type] || icons.info}"></i><span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // ===================== RENDER HELPERS =====================
    renderStars(count) {
        let html = '<div class="rating">';
        for (let i = 1; i <= 5; i++) {
            html += `<i class="fas fa-star star ${i <= count ? 'filled' : ''}"></i>`;
        }
        html += '</div>';
        return html;
    }

    renderBadge(text, type) {
        return `<span class="badge badge-${type}">${text}</span>`;
    }

    renderPingBar(latency) {
        const maxPing = 500;
        const pct = Math.min((latency / maxPing) * 100, 100);
        let color;
        if (latency < 50) color = '#22c55e';
        else if (latency < 100) color = '#4ade80';
        else if (latency < 200) color = '#f59e0b';
        else color = '#ef4444';

        return `<div class="ping-bar">
            <div class="ping-bar-track">
                <div class="ping-bar-fill" style="width:${pct}%;background:${color}"></div>
            </div>
            <span class="ping-bar-value" style="color:${color}">${latency}ms</span>
        </div>`;
    }

    // ===================== DASHBOARD =====================
    updateDashboard(results) {
        if (results.connection) {
            this.setText('dash-ip', results.connection.ip);
            this.setText('dash-location', `${results.connection.city}, ${results.connection.country}`);
            this.setText('dash-isp', results.connection.isp || 'Unknown');
        }

        if (results.dns?.length) {
            this.setText('dash-dns', `${results.dns[0].name} (${results.dns[0].latency}ms)`);
        }

        if (results.ping?.length) {
            const best = results.ping[0];
            this.setText('dash-best-vpn', `${best.flag} ${best.country} (${best.latency}ms)`);
            const avgLatency = Math.round(
                results.ping.filter(p => p.latency < 9999).reduce((a, b) => a + b.latency, 0) /
                results.ping.filter(p => p.latency < 9999).length
            );
            this.setText('dash-latency', `${avgLatency}ms`);
        }

        // Top locations
        if (results.ping?.length) {
            const topList = document.getElementById('top-locations');
            topList.innerHTML = '';
            results.ping.slice(0, 5).forEach((p, i) => {
                const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'normal';
                const li = document.createElement('li');
                li.innerHTML = `
                    <div class="location-info">
                        <span class="location-rank ${rankClass}">${i + 1}</span>
                        <span class="location-flag">${p.flag}</span>
                        <span class="location-name">${p.country} - ${p.city}</span>
                    </div>
                    <span class="location-ping" style="color:${p.latency < 100 ? '#22c55e' : p.latency < 200 ? '#f59e0b' : '#ef4444'}">${p.latency}ms</span>`;
                topList.appendChild(li);
            });
        }
    }

    // ===================== CONNECTION PAGE =====================
    updateConnectionPage(info) {
        const ipDetails = document.getElementById('ip-details');
        ipDetails.innerHTML = this.infoRows([
            ['IP Address', info.ip],
            ['Country', info.country],
            ['Country Code', info.countryCode],
            ['Region', info.region],
            ['City', info.city],
            ['Postal Code', info.postal],
            ['ASN', info.asn],
            ['ISP', info.isp],
        ]);

        const geoDetails = document.getElementById('geo-details');
        geoDetails.innerHTML = this.infoRows([
            ['Latitude', info.lat],
            ['Longitude', info.lon],
            ['Timezone', info.timezone],
        ]);

        // Map
        const geoMap = document.getElementById('geo-map');
        if (info.lat && info.lon) {
            geoMap.innerHTML = `<img src="https://maps.googleapis.com/maps/api/staticmap?center=${info.lat},${info.lon}&zoom=5&size=600x200&maptype=roadmap&style=element:geometry|color:0x1d2c4d&style=element:labels.text.fill|color:0x8ec3b9&style=element:labels.text.stroke|color:0x1a3646&markers=color:red|${info.lat},${info.lon}&key=DEMO" 
                alt="Location Map" onerror="this.parentElement.innerHTML='<div class=map-placeholder><i class=\\'fas fa-map-marked-alt\\'></i><span>Lat: ${info.lat}, Lon: ${info.lon}</span></div>'">`;
        }

        const connDetails = document.getElementById('connection-type-details');
        const ct = info.connectionType;
        connDetails.innerHTML = this.infoRows([
            ['Connection Type', typeof ct === 'object' ? ct.type : ct],
            ['Downlink', typeof ct === 'object' ? ct.downlink + ' Mbps' : 'Unknown'],
            ['RTT', typeof ct === 'object' ? ct.rtt + ' ms' : 'Unknown'],
            ['Data Saver', typeof ct === 'object' ? (ct.saveData ? 'Enabled' : 'Disabled') : 'Unknown'],
            ['WebRTC', info.webRTC],
            ['HTTPS', info.httpsSupport ? 'Yes ✓' : 'No ✗'],
            ['HTTP/2', info.http2 ? 'Yes ✓' : 'No ✗'],
            ['IPv6', info.ipv6 ? 'Supported ✓' : 'Not Available'],
        ]);

        const secDetails = document.getElementById('security-details');
        secDetails.innerHTML = this.infoRows([
            ['VPN Detected', info.isVPN ? '⚠️ Yes' : '✅ No'],
            ['Proxy Detected', info.isProxy ? '⚠️ Yes' : '✅ No'],
            ['Tor Detected', info.isTor ? '⚠️ Yes' : '✅ No'],
        ]);
    }

    // ===================== PING PAGE =====================
    updatePingPage(results) {
        // Heatmap
        const mapDiv = document.getElementById('world-ping-map');
        let heatmapHTML = '<div class="ping-heatmap">';
        results.forEach(p => {
            heatmapHTML += `
                <div class="ping-heatmap-item ${p.rating.class}">
                    <span class="flag">${p.flag}</span>
                    <span class="country-name">${p.country}</span>
                    <span class="ping-val">${p.latency < 9999 ? p.latency + 'ms' : 'N/A'}</span>
                </div>`;
        });
        heatmapHTML += '</div>';
        mapDiv.innerHTML = heatmapHTML;

        // Table
        const tbody = document.getElementById('ping-tbody');
        tbody.innerHTML = '';
        results.forEach((p, i) => {
            const tr = document.createElement('tr');
            const statusBadge = p.status === 'reachable'
                ? this.renderBadge('Online', 'success')
                : this.renderBadge('Offline', 'danger');
            tr.innerHTML = `
                <td>${i + 1}</td>
                <td>${p.flag} ${p.country}</td>
                <td>${p.city}</td>
                <td style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-muted)">${p.region}</td>
                <td>${this.renderPingBar(p.latency)}</td>
                <td>${statusBadge}</td>
                <td>${this.renderStars(p.rating.stars)}</td>`;
            tbody.appendChild(tr);
        });

        // Setup filter & sort
        this.setupPingFilters(results);
    }

    setupPingFilters(results) {
        const sortSelect = document.getElementById('ping-sort');
        const filterInput = document.getElementById('ping-filter');

        const applyFilters = () => {
            let filtered = [...results];
            const search = filterInput.value.toLowerCase();
            if (search) {
                filtered = filtered.filter(p =>
                    p.country.toLowerCase().includes(search) ||
                    p.city.toLowerCase().includes(search) ||
                    p.region.toLowerCase().includes(search)
                );
            }

            switch (sortSelect.value) {
                case 'country': filtered.sort((a, b) => a.country.localeCompare(b.country)); break;
                case 'region': filtered.sort((a, b) => a.region.localeCompare(b.region)); break;
                default: filtered.sort((a, b) => a.latency - b.latency);
            }

            this.updatePingTable(filtered);
        };

        sortSelect.addEventListener('change', applyFilters);
        filterInput.addEventListener('input', applyFilters);
    }

    updatePingTable(results) {
        const tbody = document.getElementById('ping-tbody');
        tbody.innerHTML = '';
        results.forEach((p, i) => {
            const tr = document.createElement('tr');
            const statusBadge = p.status === 'reachable'
                ? this.renderBadge('Online', 'success')
                : this.renderBadge('Offline', 'danger');
            tr.innerHTML = `
                <td>${i + 1}</td>
                <td>${p.flag} ${p.country}</td>
                <td>${p.city}</td>
                <td style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-muted)">${p.region}</td>
                <td>${this.renderPingBar(p.latency)}</td>
                <td>${statusBadge}</td>
                <td>${this.renderStars(p.rating.stars)}</td>`;
            tbody.appendChild(tr);
        });
    }

    // ===================== DNS PAGE =====================
    updateDNSPage(results) {
        // Rankings
        const ranking = document.getElementById('dns-ranking');
        ranking.innerHTML = '';
        results.slice(0, 5).forEach((d, i) => {
            ranking.innerHTML += `
                <div class="dns-rank-item">
                    <div class="rank-num">${i + 1}</div>
                    <div class="dns-rank-info">
                        <div class="dns-rank-name">${d.name}</div>
                        <div class="dns-rank-ip">${d.primary} / ${d.secondary}</div>
                    </div>
                    <div class="dns-rank-latency">${d.latency}ms</div>
                </div>`;
        });

        // Chart
        const chart = new MiniChart('dns-chart', {
            type: 'horizontalBar',
            padding: { top: 10, right: 60, bottom: 10, left: 120 }
        });
        chart.setData({
            labels: results.slice(0, 10).map(d => d.name),
            datasets: [{ data: results.slice(0, 10).map(d => d.latency), color: '#00d4ff' }]
        });

        // Table
        const tbody = document.getElementById('dns-tbody');
        tbody.innerHTML = '';
        results.forEach((d, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${i + 1}</td>
                <td><strong>${d.name}</strong></td>
                <td>${d.provider}</td>
                <td style="font-family:var(--font-mono)">${d.primary}</td>
                <td style="font-family:var(--font-mono)">${d.secondary}</td>
                <td>${this.renderPingBar(d.latency)}</td>
                <td>${d.features.map(f => `<span class="badge badge-info" style="margin:1px">${f}</span>`).join(' ')}</td>
                <td>${this.renderStars(d.rating.stars)}</td>`;
            tbody.appendChild(tr);
        });
    }

    // ===================== CDN PAGE =====================
    updateCDNPage(cdnResults, tunnelResults) {
        // CDN Table
        const cdnTbody = document.getElementById('cdn-tbody');
        cdnTbody.innerHTML = '';
        cdnResults.forEach((c, i) => {
            const tr = document.createElement('tr');
            const statusBadge = c.status === 'Accessible'
                ? this.renderBadge('Accessible', 'success')
                : this.renderBadge('Blocked', 'danger');
            tr.innerHTML = `
                <td>${i + 1}</td>
                <td><strong>${c.name}</strong></td>
                <td>${this.renderPingBar(c.latency)}</td>
                <td>${statusBadge}</td>
                <td>${c.features.map(f => `<span class="badge badge-info" style="margin:1px">${f}</span>`).join(' ')}</td>
                <td>${this.renderStars(c.rating.stars)}</td>`;
            cdnTbody.appendChild(tr);
        });

        // Tunnel Table
        const tunnelTbody = document.getElementById('tunnel-tbody');
        tunnelTbody.innerHTML = '';
        tunnelResults.forEach((t, i) => {
            const tr = document.createElement('tr');
            const statusBadge = t.status === 'Accessible'
                ? this.renderBadge('Accessible', 'success')
                : this.renderBadge('Blocked', 'danger');
            tr.innerHTML = `
                <td>${i + 1}</td>
                <td><strong>${t.name}</strong></td>
                <td>${t.protocol}</td>
                <td>${this.renderPingBar(t.latency)}</td>
                <td>${statusBadge}</td>
                <td>${this.renderStars(t.rating.stars)}</td>`;
            tunnelTbody.appendChild(tr);
        });
    }

    // ===================== PORTS PAGE =====================
    updatePortsPage(results) {
        // Visual
        const visual = document.getElementById('port-visual');
        visual.innerHTML = '';
        results.forEach(p => {
            const block = document.createElement('div');
            block.className = `port-block ${p.status}`;
            block.textContent = p.port;
            block.title = `${p.port} (${p.service}) - ${p.status.toUpperCase()}`;
            visual.appendChild(block);
        });

        // Table
        const tbody = document.getElementById('port-tbody');
        tbody.innerHTML = '';
        results.forEach(p => {
            const tr = document.createElement('tr');
            let statusBadge;
            if (p.status === 'open') statusBadge = this.renderBadge('OPEN', 'success');
            else if (p.status === 'filtered') statusBadge = this.renderBadge('FILTERED', 'warning');
            else statusBadge = this.renderBadge('CLOSED', 'danger');
            tr.innerHTML = `
                <td style="font-family:var(--font-mono);font-weight:700">${p.port}</td>
                <td><strong>${p.service}</strong></td>
                <td>${p.protocol}</td>
                <td>${statusBadge}</td>
                <td style="color:var(--text-secondary)">${p.desc}</td>`;
            tbody.appendChild(tr);
        });
    }

    // ===================== PROTOCOLS PAGE =====================
    updateProtocolsPage(results) {
        // Cards
        const grid = document.getElementById('protocol-grid');
        grid.innerHTML = '';
        results.forEach(p => {
            const iconClass = p.status === 'supported' ? 'supported' : p.status === 'partial' ? 'partial' : 'blocked';
            const icon = p.status === 'supported' ? 'fa-check' : p.status === 'partial' ? 'fa-exclamation' : 'fa-times';
            grid.innerHTML += `
                <div class="protocol-card">
                    <div class="proto-icon ${iconClass}"><i class="fas ${icon}"></i></div>
                    <div class="proto-name">${p.name}</div>
                    <div class="proto-status ${iconClass}">${p.status}</div>
                </div>`;
        });

        // Table
        const tbody = document.getElementById('protocol-tbody');
        tbody.innerHTML = '';
        results.forEach(p => {
            const tr = document.createElement('tr');
            let statusBadge;
            if (p.status === 'supported') statusBadge = this.renderBadge('Supported', 'success');
            else if (p.status === 'partial') statusBadge = this.renderBadge('Partial', 'warning');
            else statusBadge = this.renderBadge('Blocked', 'danger');
            tr.innerHTML = `
                <td><strong>${p.name}</strong></td>
                <td>${p.type}</td>
                <td style="font-family:var(--font-mono)">${p.defaultPort}</td>
                <td>${p.encryption}</td>
                <td>${p.speed}</td>
                <td>${p.security}</td>
                <td>${statusBadge}</td>
                <td style="color:${p.status === 'supported' ? 'var(--success)' : 'var(--text-muted)'}">${p.recommendation}</td>`;
            tbody.appendChild(tr);
        });
    }

    // ===================== VPN PAGE =====================
    updateVPNPage(vpnData) {
        // Summary
        const summary = document.getElementById('vpn-summary');
        const s = vpnData.summary;
        summary.innerHTML = `
            <div class="vpn-summary-card">
                <div class="vpn-summary-icon blue"><i class="fas fa-map-marker-alt"></i></div>
                <div class="vpn-summary-info">
                    <h4>Best Location</h4>
                    <div class="val">${s.bestLocation.country}</div>
                </div>
            </div>
            <div class="vpn-summary-card">
                <div class="vpn-summary-icon green"><i class="fas fa-shield-alt"></i></div>
                <div class="vpn-summary-info">
                    <h4>Best Protocol</h4>
                    <div class="val">${s.bestProtocol}</div>
                </div>
            </div>
            <div class="vpn-summary-card">
                <div class="vpn-summary-icon purple"><i class="fas fa-door-open"></i></div>
                <div class="vpn-summary-info">
                    <h4>Open VPN Ports</h4>
                    <div class="val">${s.openVPNPorts}</div>
                </div>
            </div>
            <div class="vpn-summary-card">
                <div class="vpn-summary-icon cyan"><i class="fas fa-list"></i></div>
                <div class="vpn-summary-info">
                    <h4>VPNs Tested</h4>
                    <div class="val">${s.totalTested}</div>
                </div>
            </div>`;

        // Configs
        const configs = document.getElementById('vpn-configs');
        configs.innerHTML = '';
        vpnData.configs.forEach(c => {
            let detailsHTML = '';
            Object.entries(c.details).forEach(([key, val]) => {
                detailsHTML += `
                    <div class="vpn-config-detail">
                        <span class="detail-label">${key}</span>
                        <span class="detail-value">${val}</span>
                    </div>`;
            });
            configs.innerHTML += `
                <div class="vpn-config-card">
                    <div class="vpn-config-header">
                        <div class="vpn-config-name"><i class="fas fa-cog"></i> ${c.name}</div>
                        ${c.badge ? `<span class="vpn-config-badge ${c.badge}">${c.badge}</span>` : ''}
                    </div>
                    <div class="vpn-config-details">${detailsHTML}</div>
                </div>`;
        });

        // Table
        const tbody = document.getElementById('vpn-tbody');
        tbody.innerHTML = '';
        vpnData.providers.forEach((v, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${i + 1}</td>
                <td><strong>${v.name}</strong><br><small style="color:var(--text-muted)">${v.type}</small></td>
                <td>${v.bestProtocol}</td>
                <td>${v.bestLocation}</td>
                <td>
                    <div style="display:flex;align-items:center;gap:8px">
                        <div style="flex:1;height:6px;background:var(--bg-secondary);border-radius:3px;overflow:hidden">
                            <div style="width:${v.speedScore}%;height:100%;background:var(--accent-primary);border-radius:3px"></div>
                        </div>
                        <span style="font-family:var(--font-mono);font-size:0.8rem">${v.speedScore}</span>
                    </div>
                </td>
                <td>${v.security}</td>
                <td><strong style="color:var(--accent-primary)">${v.overall}/100</strong></td>`;
            tbody.appendChild(tr);
        });
    }

    // ===================== SPEED PAGE =====================
    updateSpeedPage(speed) {
        // Update gauge values
        document.getElementById('download-speed').textContent = speed.download;
        document.getElementById('upload-speed').textContent = speed.upload;
        document.getElementById('ping-value').textContent = speed.ping;

        // Animate gauges
        const maxDl = 100, maxUl = 50, maxPing = 500;
        const circumference = 2 * Math.PI * 90;

        const dlOffset = circumference - (Math.min(speed.download / maxDl, 1) * circumference);
        const ulOffset = circumference - (Math.min(speed.upload / maxUl, 1) * circumference);
        const pingOffset = circumference - (Math.min(speed.ping / maxPing, 1) * circumference);

        document.getElementById('download-fill').style.strokeDashoffset = dlOffset;
        document.getElementById('upload-fill').style.strokeDashoffset = ulOffset;
        document.getElementById('ping-fill').style.strokeDashoffset = pingOffset;

        // Details
        const details = document.getElementById('speed-details');
        details.innerHTML = `
            <div class="speed-detail-grid">
                <div class="speed-detail-item">
                    <div class="detail-label">Download</div>
                    <div class="detail-value" style="color:var(--accent-primary)">${speed.download} Mbps</div>
                </div>
                <div class="speed-detail-item">
                    <div class="detail-label">Upload</div>
                    <div class="detail-value" style="color:var(--accent-secondary)">${speed.upload} Mbps</div>
                </div>
                <div class="speed-detail-item">
                    <div class="detail-label">Ping</div>
                    <div class="detail-value" style="color:var(--success)">${speed.ping} ms</div>
                </div>
                <div class="speed-detail-item">
                    <div class="detail-label">Jitter</div>
                    <div class="detail-value">${speed.jitter} ms</div>
                </div>
            </div>`;
    }

    // ===================== REPORT PAGE =====================
    generateReport(results) {
        const container = document.getElementById('report-container');
        let html = '';

        // Overview
        html += `<div class="report-section">
            <h3><i class="fas fa-info-circle"></i> Overview</h3>
            <div class="report-summary-grid">`;

        if (results.connection) {
            html += `
                <div class="report-summary-item"><div class="rsi-label">IP</div><div class="rsi-value">${results.connection.ip}</div></div>
                <div class="report-summary-item"><div class="rsi-label">Location</div><div class="rsi-value">${results.connection.city}, ${results.connection.country}</div></div>
                <div class="report-summary-item"><div class="rsi-label">ISP</div><div class="rsi-value">${results.connection.isp || 'Unknown'}</div></div>`;
        }
        if (results.speed) {
            html += `
                <div class="report-summary-item"><div class="rsi-label">Download</div><div class="rsi-value" style="color:var(--accent-primary)">${results.speed.download} Mbps</div></div>
                <div class="report-summary-item"><div class="rsi-label">Upload</div><div class="rsi-value" style="color:var(--accent-secondary)">${results.speed.upload} Mbps</div></div>
                <div class="report-summary-item"><div class="rsi-label">Ping</div><div class="rsi-value" style="color:var(--success)">${results.speed.ping} ms</div></div>`;
        }
        if (results.ping?.length) {
            html += `<div class="report-summary-item"><div class="rsi-label">Best VPN Location</div><div class="rsi-value">${results.ping[0].flag} ${results.ping[0].country}</div></div>`;
        }
        if (results.dns?.length) {
            html += `<div class="report-summary-item"><div class="rsi-label">Best DNS</div><div class="rsi-value">${results.dns[0].name}</div></div>`;
        }

        html += '</div></div>';

        // Ping Section
        if (results.ping?.length) {
            html += `<div class="report-section">
                <h3><i class="fas fa-globe"></i> Global Ping Results (${results.ping.length} locations)</h3>
                <div class="report-table-wrap">
                <table class="data-table"><thead><tr><th>#</th><th>Country</th><th>City</th><th>Latency</th><th>Rating</th></tr></thead><tbody>`;
            results.ping.forEach((p, i) => {
                html += `<tr><td>${i + 1}</td><td>${p.flag} ${p.country}</td><td>${p.city}</td><td>${p.latency}ms</td><td>${p.rating.label}</td></tr>`;
            });
            html += '</tbody></table></div></div>';
        }

        // DNS Section
        if (results.dns?.length) {
            html += `<div class="report-section">
                <h3><i class="fas fa-server"></i> DNS Analysis</h3>
                <div class="report-table-wrap">
                <table class="data-table"><thead><tr><th>#</th><th>Server</th><th>IP</th><th>Latency</th></tr></thead><tbody>`;
            results.dns.forEach((d, i) => {
                html += `<tr><td>${i + 1}</td><td>${d.name}</td><td>${d.primary}</td><td>${d.latency}ms</td></tr>`;
            });
            html += '</tbody></table></div></div>';
        }

        // Ports Section
        if (results.ports?.length) {
            const open = results.ports.filter(p => p.status === 'open');
            html += `<div class="report-section">
                <h3><i class="fas fa-door-open"></i> Port Scan (${open.length} open / ${results.ports.length} total)</h3>
                <div class="report-table-wrap">
                <table class="data-table"><thead><tr><th>Port</th><th>Service</th><th>Status</th></tr></thead><tbody>`;
            results.ports.forEach(p => {
                const color = p.status === 'open' ? 'var(--success)' : p.status === 'filtered' ? 'var(--warning)' : 'var(--danger)';
                html += `<tr><td>${p.port}</td><td>${p.service}</td><td style="color:${color};font-weight:700">${p.status.toUpperCase()}</td></tr>`;
            });
            html += '</tbody></table></div></div>';
        }

        // VPN Section
        if (results.vpn?.providers) {
            html += `<div class="report-section">
                <h3><i class="fas fa-lock"></i> VPN Recommendations</h3>
                <div class="report-table-wrap">
                <table class="data-table"><thead><tr><th>#</th><th>Provider</th><th>Protocol</th><th>Location</th><th>Score</th></tr></thead><tbody>`;
            results.vpn.providers.forEach((v, i) => {
                html += `<tr><td>${i + 1}</td><td>${v.name}</td><td>${v.bestProtocol}</td><td>${v.bestLocation}</td><td>${v.overall}/100</td></tr>`;
            });
            html += '</tbody></table></div></div>';
        }

        html += `<div class="report-section" style="text-align:center;color:var(--text-muted);padding:20px">
            <p>Report generated by NetScanner Pro v3.0.0 at ${new Date().toLocaleString()}</p>
        </div>`;

        container.innerHTML = html;
    }

    // ===================== HELPERS =====================
    setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    infoRows(rows) {
        return rows.map(([label, value]) =>
            `<div class="info-row"><span class="label">${label}</span><span class="value">${value || 'N/A'}</span></div>`
        ).join('');
    }

    downloadFile(content, filename, type = 'text/plain') {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

window.UI = UI;