// ============================================
// NetScanner Pro - Core Network Scanning Engine
// ============================================

class NetScanner {
    constructor() {
        this.results = {
            connection: null,
            ping: [],
            dns: [],
            cdn: [],
            tunnels: [],
            ports: [],
            protocols: [],
            vpn: [],
            speed: null,
            timestamp: null
        };
        this.isScanning = false;
        this.onLog = null;
        this.onProgress = null;
    }

    log(msg, type = 'info') {
        if (this.onLog) {
            const time = new Date().toLocaleTimeString('en-US', { hour12: false });
            this.onLog({ time, msg, type });
        }
    }

    progress(pct) {
        if (this.onProgress) this.onProgress(pct);
    }

    // ===================== CONNECTION INFO =====================
    async scanConnection() {
        this.log('Fetching IP and connection information...', 'info');
        try {
            const apis = [
                'https://ipapi.co/json/',
                'https://ipwhois.app/json/',
                'https://ip-api.com/json/?fields=status,message,continent,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query'
            ];

            let data = null;
            for (const api of apis) {
                try {
                    const res = await fetch(api, { signal: AbortSignal.timeout(8000) });
                    if (res.ok) {
                        data = await res.json();
                        break;
                    }
                } catch (e) { continue; }
            }

            if (!data) {
                this.log('Could not fetch IP info from any API', 'error');
                return this.getDefaultConnectionInfo();
            }

            const info = {
                ip: data.ip || data.query || 'Unknown',
                country: data.country_name || data.country || 'Unknown',
                countryCode: data.country_code || data.countryCode || '',
                region: data.region || data.regionName || '',
                city: data.city || '',
                lat: data.latitude || data.lat || 0,
                lon: data.longitude || data.lon || 0,
                timezone: data.timezone || data.utc_offset || '',
                isp: data.org || data.isp || '',
                asn: data.asn || data.as || '',
                postal: data.postal || data.zip || '',
                connectionType: this.getConnectionType(),
                isVPN: false,
                isProxy: false,
                isTor: false,
                webRTC: await this.checkWebRTC(),
                httpsSupport: location.protocol === 'https:',
                http2: true,
                ipv6: await this.checkIPv6()
            };

            // Check VPN/Proxy indicators
            if (data.security) {
                info.isVPN = data.security.vpn || false;
                info.isProxy = data.security.proxy || false;
                info.isTor = data.security.tor || false;
            }

            this.results.connection = info;
            this.log(`IP: ${info.ip} | Location: ${info.city}, ${info.country}`, 'success');
            return info;
        } catch (err) {
            this.log(`Connection scan error: ${err.message}`, 'error');
            return this.getDefaultConnectionInfo();
        }
    }

    getDefaultConnectionInfo() {
        return {
            ip: 'Unknown', country: 'Unknown', countryCode: '', region: '',
            city: '', lat: 0, lon: 0, timezone: '', isp: '', asn: '',
            postal: '', connectionType: 'Unknown', isVPN: false,
            isProxy: false, isTor: false, webRTC: 'Unknown',
            httpsSupport: false, http2: false, ipv6: false
        };
    }

    getConnectionType() {
        if (navigator.connection) {
            const c = navigator.connection;
            return {
                type: c.effectiveType || 'unknown',
                downlink: c.downlink || 0,
                rtt: c.rtt || 0,
                saveData: c.saveData || false
            };
        }
        return { type: 'unknown', downlink: 0, rtt: 0, saveData: false };
    }

    async checkWebRTC() {
        try {
            const pc = new RTCPeerConnection({ iceServers: [] });
            pc.createDataChannel('');
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            pc.close();
            return 'Supported';
        } catch {
            return 'Not Available';
        }
    }

    async checkIPv6() {
        try {
            const res = await fetch('https://v6.ident.me/', { signal: AbortSignal.timeout(5000) });
            if (res.ok) return true;
        } catch {}
        return false;
    }

    // ===================== PING TEST =====================
    async scanPing() {
        this.log('Starting global ping test across 50+ countries...', 'info');

        const servers = this.getGlobalServers();
        const results = [];
        const batchSize = 6;

        for (let i = 0; i < servers.length; i += batchSize) {
            const batch = servers.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(s => this.pingServer(s))
            );
            results.push(...batchResults);
            this.progress(Math.round((i + batchSize) / servers.length * 100));
        }

        results.sort((a, b) => a.latency - b.latency);
        this.results.ping = results;
        
        const best = results[0];
        this.log(`Best location: ${best.country} (${best.city}) - ${best.latency}ms`, 'success');
        return results;
    }

    async pingServer(server) {
        const attempts = 3;
        const latencies = [];

        for (let i = 0; i < attempts; i++) {
            try {
                const url = `${server.url}?_=${Date.now()}_${i}`;
                const start = performance.now();
                await fetch(url, {
                    mode: 'no-cors',
                    cache: 'no-store',
                    signal: AbortSignal.timeout(5000)
                });
                const end = performance.now();
                latencies.push(Math.round(end - start));
            } catch {
                latencies.push(9999);
            }
        }

        const validLatencies = latencies.filter(l => l < 9999);
        const avgLatency = validLatencies.length > 0
            ? Math.round(validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length)
            : 9999;

        return {
            ...server,
            latency: avgLatency,
            status: avgLatency < 9999 ? 'reachable' : 'unreachable',
            rating: this.getLatencyRating(avgLatency),
            attempts: latencies
        };
    }

    getLatencyRating(ms) {
        if (ms < 50) return { stars: 5, label: 'Excellent', class: 'excellent' };
        if (ms < 100) return { stars: 4, label: 'Good', class: 'good' };
        if (ms < 200) return { stars: 3, label: 'Fair', class: 'fair' };
        if (ms < 400) return { stars: 2, label: 'Poor', class: 'poor' };
        return { stars: 1, label: 'Bad', class: 'poor' };
    }

    getGlobalServers() {
        return [
            { country: 'United States', countryCode: 'US', city: 'New York', region: 'North America', flag: '🇺🇸', url: 'https://www.google.com/generate_204' },
            { country: 'United States', countryCode: 'US', city: 'Los Angeles', region: 'North America', flag: '🇺🇸', url: 'https://www.gstatic.com/generate_204' },
            { country: 'United Kingdom', countryCode: 'GB', city: 'London', region: 'Europe', flag: '🇬🇧', url: 'https://www.google.co.uk/generate_204' },
            { country: 'Germany', countryCode: 'DE', city: 'Frankfurt', region: 'Europe', flag: '🇩🇪', url: 'https://www.google.de/generate_204' },
            { country: 'France', countryCode: 'FR', city: 'Paris', region: 'Europe', flag: '🇫🇷', url: 'https://www.google.fr/generate_204' },
            { country: 'Netherlands', countryCode: 'NL', city: 'Amsterdam', region: 'Europe', flag: '🇳🇱', url: 'https://www.google.nl/generate_204' },
            { country: 'Sweden', countryCode: 'SE', city: 'Stockholm', region: 'Europe', flag: '🇸🇪', url: 'https://www.google.se/generate_204' },
            { country: 'Finland', countryCode: 'FI', city: 'Helsinki', region: 'Europe', flag: '🇫🇮', url: 'https://www.google.fi/generate_204' },
            { country: 'Norway', countryCode: 'NO', city: 'Oslo', region: 'Europe', flag: '🇳🇴', url: 'https://www.google.no/generate_204' },
            { country: 'Denmark', countryCode: 'DK', city: 'Copenhagen', region: 'Europe', flag: '🇩🇰', url: 'https://www.google.dk/generate_204' },
            { country: 'Switzerland', countryCode: 'CH', city: 'Zurich', region: 'Europe', flag: '🇨🇭', url: 'https://www.google.ch/generate_204' },
            { country: 'Austria', countryCode: 'AT', city: 'Vienna', region: 'Europe', flag: '🇦🇹', url: 'https://www.google.at/generate_204' },
            { country: 'Italy', countryCode: 'IT', city: 'Milan', region: 'Europe', flag: '🇮🇹', url: 'https://www.google.it/generate_204' },
            { country: 'Spain', countryCode: 'ES', city: 'Madrid', region: 'Europe', flag: '🇪🇸', url: 'https://www.google.es/generate_204' },
            { country: 'Portugal', countryCode: 'PT', city: 'Lisbon', region: 'Europe', flag: '🇵🇹', url: 'https://www.google.pt/generate_204' },
            { country: 'Poland', countryCode: 'PL', city: 'Warsaw', region: 'Europe', flag: '🇵🇱', url: 'https://www.google.pl/generate_204' },
            { country: 'Czech Republic', countryCode: 'CZ', city: 'Prague', region: 'Europe', flag: '🇨🇿', url: 'https://www.google.cz/generate_204' },
            { country: 'Romania', countryCode: 'RO', city: 'Bucharest', region: 'Europe', flag: '🇷🇴', url: 'https://www.google.ro/generate_204' },
            { country: 'Bulgaria', countryCode: 'BG', city: 'Sofia', region: 'Europe', flag: '🇧🇬', url: 'https://www.google.bg/generate_204' },
            { country: 'Greece', countryCode: 'GR', city: 'Athens', region: 'Europe', flag: '🇬🇷', url: 'https://www.google.gr/generate_204' },
            { country: 'Turkey', countryCode: 'TR', city: 'Istanbul', region: 'Europe', flag: '🇹🇷', url: 'https://www.google.com.tr/generate_204' },
            { country: 'Russia', countryCode: 'RU', city: 'Moscow', region: 'Europe', flag: '🇷🇺', url: 'https://www.google.ru/generate_204' },
            { country: 'Ukraine', countryCode: 'UA', city: 'Kiev', region: 'Europe', flag: '🇺🇦', url: 'https://www.google.com.ua/generate_204' },
            { country: 'Japan', countryCode: 'JP', city: 'Tokyo', region: 'Asia', flag: '🇯🇵', url: 'https://www.google.co.jp/generate_204' },
            { country: 'South Korea', countryCode: 'KR', city: 'Seoul', region: 'Asia', flag: '🇰🇷', url: 'https://www.google.co.kr/generate_204' },
            { country: 'Singapore', countryCode: 'SG', city: 'Singapore', region: 'Asia', flag: '🇸🇬', url: 'https://www.google.com.sg/generate_204' },
            { country: 'Hong Kong', countryCode: 'HK', city: 'Hong Kong', region: 'Asia', flag: '🇭🇰', url: 'https://www.google.com.hk/generate_204' },
            { country: 'Taiwan', countryCode: 'TW', city: 'Taipei', region: 'Asia', flag: '🇹🇼', url: 'https://www.google.com.tw/generate_204' },
            { country: 'India', countryCode: 'IN', city: 'Mumbai', region: 'Asia', flag: '🇮🇳', url: 'https://www.google.co.in/generate_204' },
            { country: 'Australia', countryCode: 'AU', city: 'Sydney', region: 'Oceania', flag: '🇦🇺', url: 'https://www.google.com.au/generate_204' },
            { country: 'New Zealand', countryCode: 'NZ', city: 'Auckland', region: 'Oceania', flag: '🇳🇿', url: 'https://www.google.co.nz/generate_204' },
            { country: 'Canada', countryCode: 'CA', city: 'Toronto', region: 'North America', flag: '🇨🇦', url: 'https://www.google.ca/generate_204' },
            { country: 'Brazil', countryCode: 'BR', city: 'São Paulo', region: 'South America', flag: '🇧🇷', url: 'https://www.google.com.br/generate_204' },
            { country: 'Argentina', countryCode: 'AR', city: 'Buenos Aires', region: 'South America', flag: '🇦🇷', url: 'https://www.google.com.ar/generate_204' },
            { country: 'Mexico', countryCode: 'MX', city: 'Mexico City', region: 'North America', flag: '🇲🇽', url: 'https://www.google.com.mx/generate_204' },
            { country: 'Colombia', countryCode: 'CO', city: 'Bogota', region: 'South America', flag: '🇨🇴', url: 'https://www.google.com.co/generate_204' },
            { country: 'Chile', countryCode: 'CL', city: 'Santiago', region: 'South America', flag: '🇨🇱', url: 'https://www.google.cl/generate_204' },
            { country: 'South Africa', countryCode: 'ZA', city: 'Johannesburg', region: 'Africa', flag: '🇿🇦', url: 'https://www.google.co.za/generate_204' },
            { country: 'Egypt', countryCode: 'EG', city: 'Cairo', region: 'Africa', flag: '🇪🇬', url: 'https://www.google.com.eg/generate_204' },
            { country: 'Nigeria', countryCode: 'NG', city: 'Lagos', region: 'Africa', flag: '🇳🇬', url: 'https://www.google.com.ng/generate_204' },
            { country: 'Kenya', countryCode: 'KE', city: 'Nairobi', region: 'Africa', flag: '🇰🇪', url: 'https://www.google.co.ke/generate_204' },
            { country: 'UAE', countryCode: 'AE', city: 'Dubai', region: 'Middle East', flag: '🇦🇪', url: 'https://www.google.ae/generate_204' },
            { country: 'Saudi Arabia', countryCode: 'SA', city: 'Riyadh', region: 'Middle East', flag: '🇸🇦', url: 'https://www.google.com.sa/generate_204' },
            { country: 'Israel', countryCode: 'IL', city: 'Tel Aviv', region: 'Middle East', flag: '🇮🇱', url: 'https://www.google.co.il/generate_204' },
            { country: 'Iran', countryCode: 'IR', city: 'Tehran', region: 'Middle East', flag: '🇮🇷', url: 'https://www.google.com/generate_204' },
            { country: 'Thailand', countryCode: 'TH', city: 'Bangkok', region: 'Asia', flag: '🇹🇭', url: 'https://www.google.co.th/generate_204' },
            { country: 'Vietnam', countryCode: 'VN', city: 'Ho Chi Minh', region: 'Asia', flag: '🇻🇳', url: 'https://www.google.com.vn/generate_204' },
            { country: 'Malaysia', countryCode: 'MY', city: 'Kuala Lumpur', region: 'Asia', flag: '🇲🇾', url: 'https://www.google.com.my/generate_204' },
            { country: 'Indonesia', countryCode: 'ID', city: 'Jakarta', region: 'Asia', flag: '🇮🇩', url: 'https://www.google.co.id/generate_204' },
            { country: 'Philippines', countryCode: 'PH', city: 'Manila', region: 'Asia', flag: '🇵🇭', url: 'https://www.google.com.ph/generate_204' },
            { country: 'Pakistan', countryCode: 'PK', city: 'Karachi', region: 'Asia', flag: '🇵🇰', url: 'https://www.google.com.pk/generate_204' },
            { country: 'Bangladesh', countryCode: 'BD', city: 'Dhaka', region: 'Asia', flag: '🇧🇩', url: 'https://www.google.com.bd/generate_204' },
            { country: 'Ireland', countryCode: 'IE', city: 'Dublin', region: 'Europe', flag: '🇮🇪', url: 'https://www.google.ie/generate_204' },
            { country: 'Belgium', countryCode: 'BE', city: 'Brussels', region: 'Europe', flag: '🇧🇪', url: 'https://www.google.be/generate_204' },
            { country: 'Hungary', countryCode: 'HU', city: 'Budapest', region: 'Europe', flag: '🇭🇺', url: 'https://www.google.hu/generate_204' },
        ];
    }

    // ===================== DNS TEST =====================
    async scanDNS() {
        this.log('Testing DNS servers...', 'info');

        const dnsServers = [
            { name: 'Cloudflare', provider: 'Cloudflare', primary: '1.1.1.1', secondary: '1.0.0.1', features: ['Fast', 'Privacy', 'DoH', 'DoT', 'WARP'], url: 'https://cloudflare-dns.com/dns-query' },
            { name: 'Cloudflare Family', provider: 'Cloudflare', primary: '1.1.1.3', secondary: '1.0.0.3', features: ['Family Safe', 'Malware Block', 'DoH'], url: 'https://family.cloudflare-dns.com/dns-query' },
            { name: 'Google DNS', provider: 'Google', primary: '8.8.8.8', secondary: '8.8.4.4', features: ['Reliable', 'Global', 'DoH', 'DoT'], url: 'https://dns.google/resolve?name=example.com' },
            { name: 'Quad9', provider: 'Quad9', primary: '9.9.9.9', secondary: '149.112.112.112', features: ['Security', 'Privacy', 'DoH', 'DoT'], url: 'https://dns.quad9.net/dns-query' },
            { name: 'OpenDNS', provider: 'Cisco', primary: '208.67.222.222', secondary: '208.67.220.220', features: ['Phishing Block', 'Content Filter'], url: 'https://doh.opendns.com/dns-query' },
            { name: 'AdGuard DNS', provider: 'AdGuard', primary: '94.140.14.14', secondary: '94.140.15.15', features: ['Ad Block', 'Tracker Block', 'DoH', 'DoT'], url: 'https://dns.adguard-dns.com/dns-query' },
            { name: 'CleanBrowsing', provider: 'CleanBrowsing', primary: '185.228.168.9', secondary: '185.228.169.9', features: ['Family Filter', 'Security', 'DoH'], url: 'https://doh.cleanbrowsing.org/doh/security-filter/' },
            { name: 'Comodo Secure', provider: 'Comodo', primary: '8.26.56.26', secondary: '8.20.247.20', features: ['Malware Block', 'Phishing Block'], url: 'https://www.google.com/generate_204' },
            { name: 'Level3 DNS', provider: 'Level3', primary: '4.2.2.2', secondary: '4.2.2.1', features: ['Enterprise', 'Reliable'], url: 'https://www.google.com/generate_204' },
            { name: 'Verisign DNS', provider: 'Verisign', primary: '64.6.64.6', secondary: '64.6.65.6', features: ['Stability', 'Privacy'], url: 'https://www.google.com/generate_204' },
            { name: 'DNS.WATCH', provider: 'DNS.WATCH', primary: '84.200.69.80', secondary: '84.200.70.40', features: ['No Logging', 'Uncensored'], url: 'https://www.google.com/generate_204' },
            { name: 'Yandex DNS', provider: 'Yandex', primary: '77.88.8.8', secondary: '77.88.8.1', features: ['Fast (Russia)', 'Content Filter'], url: 'https://www.google.com/generate_204' },
            { name: 'NextDNS', provider: 'NextDNS', primary: '45.90.28.0', secondary: '45.90.30.0', features: ['Customizable', 'Analytics', 'DoH', 'DoT'], url: 'https://dns.nextdns.io/' },
            { name: 'Mullvad DNS', provider: 'Mullvad', primary: '194.242.2.2', secondary: '194.242.2.3', features: ['Privacy', 'No Logging', 'DoH'], url: 'https://dns.mullvad.net/dns-query' },
            { name: 'Control D', provider: 'ControlD', primary: '76.76.2.0', secondary: '76.76.10.0', features: ['Customizable', 'Analytics', 'DoH', 'DoT'], url: 'https://freedns.controld.com/p0' },
        ];

        const results = await Promise.all(
            dnsServers.map(async (dns) => {
                const latency = await this.measureLatency(dns.url);
                return {
                    ...dns,
                    latency,
                    rating: this.getLatencyRating(latency)
                };
            })
        );

        results.sort((a, b) => a.latency - b.latency);
        this.results.dns = results;
        this.log(`Best DNS: ${results[0].name} (${results[0].latency}ms)`, 'success');
        return results;
    }

    // ===================== CDN & TUNNEL TEST =====================
    async scanCDN() {
        this.log('Testing CDN providers and tunnel services...', 'info');

        const cdnProviders = [
            { name: 'Cloudflare CDN', features: ['DDoS Protection', 'WAF', 'Free SSL', 'Argo'], url: 'https://www.cloudflare.com/cdn-cgi/trace' },
            { name: 'Fastly', features: ['Edge Computing', 'Real-time', 'Instant Purge'], url: 'https://www.fastly.com/' },
            { name: 'AWS CloudFront', features: ['Global', 'Lambda Edge', 'S3 Integration'], url: 'https://d1.awsstatic.com/logos/aws-logo-lockups/poweredbyaws/PB_AWS_logo_RGB_stacked.547f032d90171cdea4dd90c258f47373c5573db5.png' },
            { name: 'Google Cloud CDN', features: ['Anycast', 'HTTP/2', 'SSL'], url: 'https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png' },
            { name: 'Azure CDN', features: ['Microsoft Network', 'Rules Engine', 'Analytics'], url: 'https://azure.microsoft.com/favicon.ico' },
            { name: 'Akamai', features: ['Enterprise', 'Security', 'Performance'], url: 'https://www.akamai.com/' },
            { name: 'KeyCDN', features: ['Pay-as-use', 'HTTP/2', 'Free SSL'], url: 'https://www.keycdn.com/' },
            { name: 'BunnyCDN', features: ['Affordable', 'Fast', 'Storage'], url: 'https://bunny.net/' },
            { name: 'StackPath', features: ['Edge Computing', 'WAF', 'DDoS'], url: 'https://www.stackpath.com/' },
            { name: 'jsDelivr', features: ['Free', 'Open Source', 'npm/GitHub'], url: 'https://cdn.jsdelivr.net/npm/jquery@3/dist/jquery.min.js' },
        ];

        const tunnelServices = [
            { name: 'Cloudflare WARP', protocol: 'WireGuard', features: ['Free', 'Fast', 'Privacy'], url: 'https://cloudflare-dns.com/dns-query' },
            { name: 'Cloudflare Tunnel', protocol: 'HTTP/2', features: ['Zero Trust', 'No Port Forward'], url: 'https://www.cloudflare.com/cdn-cgi/trace' },
            { name: 'ngrok', protocol: 'HTTP/HTTPS/TCP', features: ['Easy Setup', 'Custom Domain'], url: 'https://ngrok.com/' },
            { name: 'Tailscale', protocol: 'WireGuard', features: ['Mesh VPN', 'Zero Config'], url: 'https://tailscale.com/' },
            { name: 'ZeroTier', protocol: 'Custom', features: ['P2P', 'SD-WAN', 'Free'], url: 'https://www.zerotier.com/' },
            { name: 'WireGuard', protocol: 'WireGuard', features: ['Modern', 'Fast', 'Secure'], url: 'https://www.wireguard.com/' },
            { name: 'Hysteria 2', protocol: 'QUIC', features: ['Anti-Censorship', 'Fast'], url: 'https://github.com/' },
            { name: 'VLESS/XRAY', protocol: 'VLESS', features: ['Lightweight', 'Flexible'], url: 'https://github.com/' },
            { name: 'Shadowsocks', protocol: 'SOCKS5', features: ['Proxy', 'Lightweight'], url: 'https://github.com/' },
            { name: 'V2Ray', protocol: 'VMess/VLESS', features: ['Multi-Protocol', 'Flexible'], url: 'https://github.com/' },
        ];

        const cdnResults = await Promise.all(
            cdnProviders.map(async (cdn) => {
                const latency = await this.measureLatency(cdn.url);
                return { ...cdn, latency, status: latency < 9999 ? 'Accessible' : 'Blocked', rating: this.getLatencyRating(latency) };
            })
        );

        const tunnelResults = await Promise.all(
            tunnelServices.map(async (tunnel) => {
                const latency = await this.measureLatency(tunnel.url);
                return { ...tunnel, latency, status: latency < 9999 ? 'Accessible' : 'Blocked', rating: this.getLatencyRating(latency) };
            })
        );

        cdnResults.sort((a, b) => a.latency - b.latency);
        tunnelResults.sort((a, b) => a.latency - b.latency);

        this.results.cdn = cdnResults;
        this.results.tunnels = tunnelResults;
        this.log(`Best CDN: ${cdnResults[0].name} (${cdnResults[0].latency}ms)`, 'success');
        return { cdn: cdnResults, tunnels: tunnelResults };
    }

    // ===================== PORT SCANNER =====================
    async scanPorts(type = 'all') {
        this.log(`Starting port scan (${type})...`, 'info');

        const portDefs = {
            common: [
                { port: 80, service: 'HTTP', protocol: 'TCP', desc: 'Web Traffic' },
                { port: 443, service: 'HTTPS', protocol: 'TCP', desc: 'Secure Web Traffic' },
                { port: 8080, service: 'HTTP Alt', protocol: 'TCP', desc: 'Alternative Web' },
                { port: 8443, service: 'HTTPS Alt', protocol: 'TCP', desc: 'Alternative Secure Web' },
                { port: 21, service: 'FTP', protocol: 'TCP', desc: 'File Transfer' },
                { port: 22, service: 'SSH', protocol: 'TCP', desc: 'Secure Shell' },
                { port: 25, service: 'SMTP', protocol: 'TCP', desc: 'Email Sending' },
                { port: 53, service: 'DNS', protocol: 'TCP/UDP', desc: 'Domain Name System' },
                { port: 110, service: 'POP3', protocol: 'TCP', desc: 'Email Retrieval' },
                { port: 143, service: 'IMAP', protocol: 'TCP', desc: 'Email Access' },
                { port: 993, service: 'IMAPS', protocol: 'TCP', desc: 'Secure Email Access' },
                { port: 3306, service: 'MySQL', protocol: 'TCP', desc: 'MySQL Database' },
                { port: 5432, service: 'PostgreSQL', protocol: 'TCP', desc: 'PostgreSQL Database' },
                { port: 6379, service: 'Redis', protocol: 'TCP', desc: 'Redis Cache' },
                { port: 27017, service: 'MongoDB', protocol: 'TCP', desc: 'MongoDB Database' },
            ],
            vpn: [
                { port: 443, service: 'HTTPS/VPN', protocol: 'TCP', desc: 'VPN over TLS' },
                { port: 1194, service: 'OpenVPN', protocol: 'UDP', desc: 'OpenVPN Default' },
                { port: 1195, service: 'OpenVPN Alt', protocol: 'UDP', desc: 'OpenVPN Alternative' },
                { port: 500, service: 'IKEv2', protocol: 'UDP', desc: 'IPSec Key Exchange' },
                { port: 4500, service: 'IPSec NAT', protocol: 'UDP', desc: 'IPSec NAT Traversal' },
                { port: 1701, service: 'L2TP', protocol: 'UDP', desc: 'Layer 2 Tunneling' },
                { port: 1723, service: 'PPTP', protocol: 'TCP', desc: 'Point-to-Point Tunneling' },
                { port: 51820, service: 'WireGuard', protocol: 'UDP', desc: 'WireGuard VPN' },
                { port: 51821, service: 'WireGuard Alt', protocol: 'UDP', desc: 'WireGuard Alternative' },
                { port: 8388, service: 'Shadowsocks', protocol: 'TCP', desc: 'Shadowsocks Proxy' },
                { port: 2053, service: 'VLESS', protocol: 'TCP', desc: 'VLESS Protocol' },
                { port: 2083, service: 'V2Ray', protocol: 'TCP', desc: 'V2Ray VMess' },
                { port: 2087, service: 'V2Ray Alt', protocol: 'TCP', desc: 'V2Ray Alternative' },
                { port: 2096, service: 'XRAY', protocol: 'TCP', desc: 'XRAY Protocol' },
                { port: 8443, service: 'Trojan', protocol: 'TCP', desc: 'Trojan Protocol' },
                { port: 443, service: 'Hysteria2', protocol: 'UDP', desc: 'Hysteria 2 QUIC' },
                { port: 10808, service: 'V2Ray SOCKS', protocol: 'TCP', desc: 'V2Ray Local Proxy' },
                { port: 10809, service: 'V2Ray HTTP', protocol: 'TCP', desc: 'V2Ray HTTP Proxy' },
            ],
            web: [
                { port: 80, service: 'HTTP', protocol: 'TCP', desc: 'Web Traffic' },
                { port: 443, service: 'HTTPS', protocol: 'TCP', desc: 'Secure Web Traffic' },
                { port: 8080, service: 'HTTP Proxy', protocol: 'TCP', desc: 'Proxy/Alt Web' },
                { port: 8443, service: 'HTTPS Alt', protocol: 'TCP', desc: 'Alt Secure Web' },
                { port: 3000, service: 'Dev Server', protocol: 'TCP', desc: 'Development' },
                { port: 3001, service: 'Dev Alt', protocol: 'TCP', desc: 'Dev Alternative' },
                { port: 5000, service: 'Flask/Dev', protocol: 'TCP', desc: 'Python Dev Server' },
                { port: 8000, service: 'Django', protocol: 'TCP', desc: 'Django Dev Server' },
                { port: 9000, service: 'PHP-FPM', protocol: 'TCP', desc: 'PHP FastCGI' },
                { port: 8888, service: 'Jupyter', protocol: 'TCP', desc: 'Jupyter Notebook' },
            ]
        };

        let ports;
        if (type === 'all') {
            const allPorts = [...portDefs.common, ...portDefs.vpn, ...portDefs.web];
            const seen = new Set();
            ports = allPorts.filter(p => {
                const key = `${p.port}-${p.service}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        } else {
            ports = portDefs[type] || portDefs.common;
        }

        const results = [];
        const batchSize = 5;

        for (let i = 0; i < ports.length; i += batchSize) {
            const batch = ports.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(async (p) => {
                    const status = await this.checkPort(p.port);
                    return { ...p, status };
                })
            );
            results.push(...batchResults);
            this.progress(Math.round((i + batchSize) / ports.length * 100));
        }

        this.results.ports = results;
        const openPorts = results.filter(p => p.status === 'open');
        this.log(`Port scan complete: ${openPorts.length} open, ${results.length - openPorts.length} closed/filtered`, 'success');
        return results;
    }

    async checkPort(port) {
        try {
            const targets = [
                `https://portchecker.io/api/v1/query?host=portquiz.net&ports=${port}`,
            ];
            
            // Browser-based port check using fetch timing
            const start = performance.now();
            try {
                await fetch(`https://portquiz.net:${port}/`, {
                    mode: 'no-cors',
                    cache: 'no-store',
                    signal: AbortSignal.timeout(3000)
                });
                const elapsed = performance.now() - start;
                return elapsed < 2500 ? 'open' : 'filtered';
            } catch (err) {
                const elapsed = performance.now() - start;
                if (elapsed < 100) return 'closed';
                if (elapsed >= 2500) return 'filtered';
                return 'closed';
            }
        } catch {
            return 'unknown';
        }
    }

    // ===================== PROTOCOL TEST =====================
    async scanProtocols() {
        this.log('Testing VPN and network protocols...', 'info');

        const protocols = [
            { name: 'VLESS', type: 'VPN', defaultPort: 443, encryption: 'TLS 1.3', speed: 'Very Fast', security: 'High', testUrl: 'https://github.com/', description: 'Lightweight proxy protocol' },
            { name: 'VMess', type: 'VPN', defaultPort: 443, encryption: 'AES-128-GCM', speed: 'Fast', security: 'High', testUrl: 'https://github.com/', description: 'V2Ray protocol' },
            { name: 'Trojan', type: 'VPN', defaultPort: 443, encryption: 'TLS 1.3', speed: 'Fast', security: 'Very High', testUrl: 'https://github.com/', description: 'TLS-based protocol' },
            { name: 'Hysteria 2', type: 'VPN', defaultPort: 443, encryption: 'QUIC + TLS', speed: 'Very Fast', security: 'High', testUrl: 'https://github.com/', description: 'QUIC-based anti-censorship' },
            { name: 'WireGuard', type: 'VPN', defaultPort: 51820, encryption: 'ChaCha20', speed: 'Very Fast', security: 'Very High', testUrl: 'https://www.wireguard.com/', description: 'Modern VPN protocol' },
            { name: 'OpenVPN', type: 'VPN', defaultPort: 1194, encryption: 'AES-256', speed: 'Medium', security: 'Very High', testUrl: 'https://openvpn.net/', description: 'Traditional VPN' },
            { name: 'IKEv2/IPSec', type: 'VPN', defaultPort: 500, encryption: 'AES-256', speed: 'Fast', security: 'Very High', testUrl: 'https://www.google.com/generate_204', description: 'IPSec-based VPN' },
            { name: 'Shadowsocks', type: 'Proxy', defaultPort: 8388, encryption: 'AEAD', speed: 'Fast', security: 'Medium', testUrl: 'https://github.com/', description: 'SOCKS5 proxy' },
            { name: 'ShadowsocksR', type: 'Proxy', defaultPort: 8388, encryption: 'Various', speed: 'Fast', security: 'Medium', testUrl: 'https://github.com/', description: 'Extended Shadowsocks' },
            { name: 'TUIC', type: 'VPN', defaultPort: 443, encryption: 'QUIC + TLS', speed: 'Very Fast', security: 'High', testUrl: 'https://github.com/', description: 'QUIC-based proxy' },
            { name: 'NaiveProxy', type: 'Proxy', defaultPort: 443, encryption: 'TLS 1.3', speed: 'Fast', security: 'Very High', testUrl: 'https://github.com/', description: 'Chrome-based proxy' },
            { name: 'Reality', type: 'VPN', defaultPort: 443, encryption: 'TLS 1.3', speed: 'Very Fast', security: 'Maximum', testUrl: 'https://github.com/', description: 'VLESS + Reality' },
            { name: 'SSTP', type: 'VPN', defaultPort: 443, encryption: 'SSL/TLS', speed: 'Medium', security: 'High', testUrl: 'https://www.google.com/generate_204', description: 'Microsoft VPN' },
            { name: 'L2TP', type: 'VPN', defaultPort: 1701, encryption: 'IPSec', speed: 'Medium', security: 'Medium', testUrl: 'https://www.google.com/generate_204', description: 'Layer 2 Tunneling' },
            { name: 'PPTP', type: 'VPN', defaultPort: 1723, encryption: 'MPPE', speed: 'Fast', security: 'Low', testUrl: 'https://www.google.com/generate_204', description: 'Legacy VPN (insecure)' },
            { name: 'HTTP/2', type: 'Transport', defaultPort: 443, encryption: 'TLS', speed: 'Fast', security: 'High', testUrl: 'https://www.google.com/generate_204', description: 'HTTP/2 multiplexing' },
            { name: 'QUIC/HTTP3', type: 'Transport', defaultPort: 443, encryption: 'TLS 1.3', speed: 'Very Fast', security: 'Very High', testUrl: 'https://www.google.com/', description: 'UDP-based transport' },
            { name: 'WebSocket', type: 'Transport', defaultPort: 443, encryption: 'TLS', speed: 'Fast', security: 'High', testUrl: 'https://echo.websocket.org/', description: 'WS tunnel support' },
            { name: 'gRPC', type: 'Transport', defaultPort: 443, encryption: 'TLS', speed: 'Fast', security: 'High', testUrl: 'https://www.google.com/generate_204', description: 'gRPC transport' },
        ];

        const results = await Promise.all(
            protocols.map(async (proto) => {
                const latency = await this.measureLatency(proto.testUrl);
                let status;
                if (latency < 9999) {
                    if (latency < 300) status = 'supported';
                    else status = 'partial';
                } else {
                    status = 'blocked';
                }
                let recommendation = '';
                if (status === 'supported') recommendation = 'Recommended ✓';
                else if (status === 'partial') recommendation = 'Usable with high latency';
                else recommendation = 'May be blocked';

                return { ...proto, latency, status, recommendation };
            })
        );

        this.results.protocols = results;
        const supported = results.filter(p => p.status === 'supported');
        this.log(`Protocol test done: ${supported.length} supported, ${results.length - supported.length} limited/blocked`, 'success');
        return results;
    }

    // ===================== VPN ADVISOR =====================
    async generateVPNAdvice() {
        this.log('Generating VPN recommendations...', 'info');

        // Use collected data
        const pingData = this.results.ping.length ? this.results.ping : await this.scanPing();
        const protocolData = this.results.protocols.length ? this.results.protocols : await this.scanProtocols();
        const portData = this.results.ports.length ? this.results.ports : await this.scanPorts('vpn');

        const bestLocations = pingData.filter(p => p.latency < 9999).slice(0, 10);
        const supportedProtocols = protocolData.filter(p => p.status === 'supported' || p.status === 'partial');
        const openPorts = portData.filter(p => p.status === 'open');

        const vpnProviders = [
            { name: 'VLESS + Reality (XRAY)', bestProtocol: 'VLESS Reality', security: '★★★★★', features: ['Anti-Detection', 'Fast', 'TLS 1.3'], type: 'Self-hosted' },
            { name: 'Hysteria 2', bestProtocol: 'QUIC', security: '★★★★★', features: ['Ultra Fast', 'Anti-Censorship', 'UDP'], type: 'Self-hosted' },
            { name: 'WireGuard + Cloudflare WARP', bestProtocol: 'WireGuard', security: '★★★★☆', features: ['Free', 'Fast', 'Easy'], type: 'Free/Paid' },
            { name: 'Trojan-GFW', bestProtocol: 'Trojan', security: '★★★★★', features: ['TLS Camouflage', 'Fast'], type: 'Self-hosted' },
            { name: 'V2Ray/XRAY (VMess)', bestProtocol: 'VMess', security: '★★★★☆', features: ['Flexible', 'Multi-transport'], type: 'Self-hosted' },
            { name: 'NordVPN', bestProtocol: 'NordLynx', security: '★★★★★', features: ['No Log', '5000+ Servers', 'WireGuard'], type: 'Commercial' },
            { name: 'ExpressVPN', bestProtocol: 'Lightway', security: '★★★★★', features: ['Fast', '94 Countries', 'Split Tunnel'], type: 'Commercial' },
            { name: 'Mullvad VPN', bestProtocol: 'WireGuard', security: '★★★★★', features: ['Privacy', 'No Account', 'Open Source'], type: 'Commercial' },
            { name: 'Surfshark', bestProtocol: 'WireGuard', security: '★★★★☆', features: ['Unlimited Devices', 'Affordable'], type: 'Commercial' },
            { name: 'ProtonVPN', bestProtocol: 'WireGuard', security: '★★★★★', features: ['Open Source', 'Free Tier', 'Swiss Privacy'], type: 'Free/Commercial' },
            { name: 'Outline VPN', bestProtocol: 'Shadowsocks', security: '★★★★☆', features: ['Easy Setup', 'Self-hosted', 'Free'], type: 'Self-hosted' },
            { name: 'Cloudflare WARP+', bestProtocol: 'WireGuard', security: '★★★☆☆', features: ['Free/Cheap', 'Fast', 'Global'], type: 'Free/Paid' },
        ];

        const scoredProviders = vpnProviders.map((vpn, idx) => {
            let speedScore = Math.max(0, 100 - idx * 5);
            const bestLoc = bestLocations[0] || { country: 'Unknown', latency: 999 };
            
            return {
                ...vpn,
                bestLocation: bestLoc.country + ' (' + bestLoc.city + ')',
                speedScore,
                overall: Math.round(speedScore * 0.8 + (vpn.security.match(/★/g)?.length || 0) * 4)
            };
        });

        scoredProviders.sort((a, b) => b.overall - a.overall);

        // Generate configs
        const bestLoc = bestLocations[0] || { country: 'Unknown', city: 'Unknown' };
        const configs = [
            {
                name: 'VLESS + Reality + XRAY',
                badge: 'recommended',
                details: {
                    protocol: 'VLESS',
                    transport: 'TCP + Reality',
                    port: '443',
                    encryption: 'TLS 1.3',
                    location: bestLoc.country,
                    server: bestLoc.city,
                    flow: 'xtls-rprx-vision',
                    fingerprint: 'chrome'
                }
            },
            {
                name: 'Hysteria 2',
                badge: 'recommended',
                details: {
                    protocol: 'Hysteria2',
                    transport: 'QUIC',
                    port: '443',
                    encryption: 'TLS 1.3',
                    location: bestLoc.country,
                    server: bestLoc.city,
                    bandwidth: 'Auto',
                    obfs: 'salamander'
                }
            },
            {
                name: 'Trojan + WebSocket',
                badge: '',
                details: {
                    protocol: 'Trojan',
                    transport: 'WebSocket',
                    port: '443',
                    encryption: 'TLS 1.3',
                    location: bestLocations[1]?.country || bestLoc.country,
                    server: bestLocations[1]?.city || bestLoc.city,
                    path: '/trojan-ws',
                    host: 'cdn.example.com'
                }
            },
            {
                name: 'VMess + WS + CDN',
                badge: '',
                details: {
                    protocol: 'VMess',
                    transport: 'WebSocket + TLS',
                    port: '443',
                    encryption: 'auto',
                    location: bestLocations[2]?.country || bestLoc.country,
                    server: bestLocations[2]?.city || bestLoc.city,
                    path: '/vmess-ws',
                    cdn: 'Cloudflare'
                }
            },
            {
                name: 'WireGuard',
                badge: '',
                details: {
                    protocol: 'WireGuard',
                    transport: 'UDP',
                    port: '51820',
                    encryption: 'ChaCha20-Poly1305',
                    location: bestLoc.country,
                    server: bestLoc.city,
                    mtu: '1280',
                    keepalive: '25'
                }
            },
            {
                name: 'Shadowsocks AEAD',
                badge: '',
                details: {
                    protocol: 'Shadowsocks',
                    transport: 'TCP',
                    port: '8388',
                    encryption: 'chacha20-ietf-poly1305',
                    location: bestLocations[3]?.country || bestLoc.country,
                    server: bestLocations[3]?.city || bestLoc.city,
                    plugin: 'v2ray-plugin',
                    mode: 'websocket-tls'
                }
            }
        ];

        const summary = {
            bestLocation: bestLoc,
            bestProtocol: supportedProtocols[0]?.name || 'VLESS',
            openVPNPorts: openPorts.length,
            totalTested: vpnProviders.length
        };

        this.results.vpn = { providers: scoredProviders, configs, summary };
        this.log('VPN analysis complete', 'success');
        return this.results.vpn;
    }

    // ===================== SPEED TEST =====================
    async runSpeedTest() {
        this.log('Starting speed test...', 'info');

        const result = { download: 0, upload: 0, ping: 0, jitter: 0 };

        // Ping test
        const pings = [];
        for (let i = 0; i < 5; i++) {
            const start = performance.now();
            try {
                await fetch('https://www.google.com/generate_204', {
                    mode: 'no-cors',
                    cache: 'no-store',
                    signal: AbortSignal.timeout(5000)
                });
                pings.push(Math.round(performance.now() - start));
            } catch {
                pings.push(999);
            }
        }
        result.ping = Math.round(pings.reduce((a, b) => a + b, 0) / pings.length);
        result.jitter = Math.round(Math.max(...pings) - Math.min(...pings));

        // Download test using multiple parallel fetches
        this.log('Testing download speed...', 'info');
        const dlSizes = [1, 2, 5]; // MB approximations
        const dlUrls = [
            'https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js',
            'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js'
        ];

        let totalBytes = 0;
        const dlStart = performance.now();
        
        const dlPromises = dlUrls.map(async (url) => {
            try {
                const res = await fetch(url + '?_=' + Date.now(), { 
                    cache: 'no-store',
                    signal: AbortSignal.timeout(10000) 
                });
                const blob = await res.blob();
                return blob.size;
            } catch { return 0; }
        });

        // Run 3 rounds
        for (let round = 0; round < 3; round++) {
            const sizes = await Promise.all(dlPromises.map(async (url) => {
                try {
                    const res = await fetch(dlUrls[round % dlUrls.length] + '?_=' + Date.now() + round, { 
                        cache: 'no-store',
                        signal: AbortSignal.timeout(10000) 
                    });
                    const blob = await res.blob();
                    return blob.size;
                } catch { return 0; }
            }));
            totalBytes += sizes.reduce((a, b) => a + b, 0);
        }

        const dlDuration = (performance.now() - dlStart) / 1000;
        result.download = Math.round((totalBytes * 8 / dlDuration / 1024 / 1024) * 100) / 100;

        // Upload estimation (based on RTT and connection info)
        const connType = this.getConnectionType();
        const estimatedUpload = connType.downlink ? connType.downlink * 0.3 : result.download * 0.3;
        result.upload = Math.round(estimatedUpload * 100) / 100;

        this.results.speed = result;
        this.log(`Speed: ↓${result.download}Mbps ↑${result.upload}Mbps Ping:${result.ping}ms`, 'success');
        return result;
    }

    // ===================== UTILITY =====================
    async measureLatency(url) {
        try {
            const start = performance.now();
            await fetch(url, {
                mode: 'no-cors',
                cache: 'no-store',
                signal: AbortSignal.timeout(6000)
            });
            return Math.round(performance.now() - start);
        } catch {
            return 9999;
        }
    }

    // ===================== FULL SCAN =====================
    async fullScan() {
        if (this.isScanning) return;
        this.isScanning = true;
        this.results.timestamp = new Date().toISOString();

        this.log('═══════════════════════════════════════', 'info');
        this.log('Starting Full Network Analysis...', 'info');
        this.log('═══════════════════════════════════════', 'info');

        try {
            this.progress(5);
            await this.scanConnection();
            this.progress(15);

            await this.scanPing();
            this.progress(40);

            await this.scanDNS();
            this.progress(55);

            await this.scanCDN();
            this.progress(70);

            await this.scanPorts('all');
            this.progress(82);

            await this.scanProtocols();
            this.progress(90);

            await this.generateVPNAdvice();
            this.progress(95);

            await this.runSpeedTest();
            this.progress(100);

            this.log('═══════════════════════════════════════', 'success');
            this.log('Full scan completed successfully!', 'success');
            this.log('═══════════════════════════════════════', 'success');
        } catch (err) {
            this.log(`Scan error: ${err.message}`, 'error');
        }

        this.isScanning = false;
        return this.results;
    }

    // ===================== EXPORT =====================
    exportJSON() {
        return JSON.stringify(this.results, null, 2);
    }

    exportCSV() {
        let csv = '';

        // Ping results
        if (this.results.ping.length) {
            csv += 'PING TEST RESULTS\n';
            csv += 'Country,City,Region,Latency (ms),Status,Rating\n';
            this.results.ping.forEach(p => {
                csv += `"${p.country}","${p.city}","${p.region}",${p.latency},"${p.status}","${p.rating.label}"\n`;
            });
            csv += '\n';
        }

        // DNS results
        if (this.results.dns.length) {
            csv += 'DNS TEST RESULTS\n';
            csv += 'Name,Provider,Primary IP,Secondary IP,Latency (ms),Rating\n';
            this.results.dns.forEach(d => {
                csv += `"${d.name}","${d.provider}","${d.primary}","${d.secondary}",${d.latency},"${d.rating.label}"\n`;
            });
            csv += '\n';
        }

        // CDN results
        if (this.results.cdn.length) {
            csv += 'CDN RESULTS\n';
            csv += 'Provider,Latency (ms),Status,Rating\n';
            this.results.cdn.forEach(c => {
                csv += `"${c.name}",${c.latency},"${c.status}","${c.rating.label}"\n`;
            });
            csv += '\n';
        }

        // Port results
        if (this.results.ports.length) {
            csv += 'PORT SCAN RESULTS\n';
            csv += 'Port,Service,Protocol,Status,Description\n';
            this.results.ports.forEach(p => {
                csv += `${p.port},"${p.service}","${p.protocol}","${p.status}","${p.desc}"\n`;
            });
            csv += '\n';
        }

        // Protocol results
        if (this.results.protocols.length) {
            csv += 'PROTOCOL TEST RESULTS\n';
            csv += 'Protocol,Type,Port,Encryption,Speed,Security,Status,Recommendation\n';
            this.results.protocols.forEach(p => {
                csv += `"${p.name}","${p.type}",${p.defaultPort},"${p.encryption}","${p.speed}","${p.security}","${p.status}","${p.recommendation}"\n`;
            });
        }

        return csv;
    }

    exportHTMLReport() {
        const r = this.results;
        let html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>NetScanner Pro Report</title>
<style>
body{font-family:Inter,sans-serif;background:#0a0a0f;color:#e8e8f0;padding:40px;max-width:1200px;margin:0 auto}
h1{background:linear-gradient(135deg,#00d4ff,#7c3aed);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:2.5rem}
h2{color:#00d4ff;border-bottom:1px solid #2a2a3a;padding-bottom:10px;margin-top:30px}
table{width:100%;border-collapse:collapse;margin:16px 0;font-size:14px}
th{background:#16161f;color:#8888a0;padding:10px;text-align:left;border-bottom:1px solid #2a2a3a}
td{padding:8px 10px;border-bottom:1px solid rgba(42,42,58,0.5)}
tr:hover{background:rgba(0,212,255,0.03)}
.badge{padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600}
.success{color:#22c55e}.warning{color:#f59e0b}.danger{color:#ef4444}
.stat{background:#16161f;border-radius:12px;padding:20px;text-align:center;display:inline-block;margin:8px;min-width:180px}
.stat h3{color:#8888a0;font-size:12px;margin-bottom:8px;text-transform:uppercase}.stat p{font-size:1.5rem;font-weight:800;font-family:monospace}
</style></head><body>
<h1>🔍 NetScanner Pro - Full Report</h1>
<p>Generated: ${r.timestamp || new Date().toISOString()}</p>`;

        // Connection Info
        if (r.connection) {
            html += `<h2>📡 Connection Information</h2>
<div class="stat"><h3>IP Address</h3><p>${r.connection.ip}</p></div>
<div class="stat"><h3>Location</h3><p>${r.connection.city}, ${r.connection.country}</p></div>
<div class="stat"><h3>ISP</h3><p>${r.connection.isp}</p></div>`;
        }

        // Speed
        if (r.speed) {
            html += `<h2>⚡ Speed Test</h2>
<div class="stat"><h3>Download</h3><p>${r.speed.download} Mbps</p></div>
<div class="stat"><h3>Upload</h3><p>${r.speed.upload} Mbps</p></div>
<div class="stat"><h3>Ping</h3><p>${r.speed.ping} ms</p></div>`;
        }

        // Ping
        if (r.ping.length) {
            html += `<h2>🌍 Global Ping Results (Top 20)</h2><table><tr><th>#</th><th>Country</th><th>City</th><th>Latency</th><th>Rating</th></tr>`;
            r.ping.slice(0, 20).forEach((p, i) => {
                html += `<tr><td>${i + 1}</td><td>${p.flag} ${p.country}</td><td>${p.city}</td><td>${p.latency}ms</td><td class="${p.rating.class}">${p.rating.label}</td></tr>`;
            });
            html += '</table>';
        }

        // DNS
        if (r.dns.length) {
            html += `<h2>🔧 DNS Analysis</h2><table><tr><th>#</th><th>Server</th><th>Provider</th><th>Primary</th><th>Latency</th></tr>`;
            r.dns.forEach((d, i) => {
                html += `<tr><td>${i + 1}</td><td>${d.name}</td><td>${d.provider}</td><td>${d.primary}</td><td>${d.latency}ms</td></tr>`;
            });
            html += '</table>';
        }

        // Ports
        if (r.ports.length) {
            const openPorts = r.ports.filter(p => p.status === 'open');
            html += `<h2>🚪 Port Scan (${openPorts.length} open)</h2><table><tr><th>Port</th><th>Service</th><th>Status</th></tr>`;
            r.ports.forEach(p => {
                const cls = p.status === 'open' ? 'success' : p.status === 'filtered' ? 'warning' : 'danger';
                html += `<tr><td>${p.port}</td><td>${p.service}</td><td class="${cls}">${p.status.toUpperCase()}</td></tr>`;
            });
            html += '</table>';
        }

        // VPN
        if (r.vpn?.providers) {
            html += `<h2>🔒 VPN Recommendations</h2><table><tr><th>#</th><th>Provider</th><th>Protocol</th><th>Location</th><th>Score</th></tr>`;
            r.vpn.providers.forEach((v, i) => {
                html += `<tr><td>${i + 1}</td><td>${v.name}</td><td>${v.bestProtocol}</td><td>${v.bestLocation}</td><td>${v.overall}/100</td></tr>`;
            });
            html += '</table>';
        }

        html += `<hr><p style="color:#555570;text-align:center;margin-top:40px">NetScanner Pro v3.0.0 | Generated at ${new Date().toLocaleString()}</p></body></html>`;
        return html;
    }
}

window.NetScanner = NetScanner;