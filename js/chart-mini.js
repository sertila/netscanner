// ============================================
// NetScanner Pro - Mini Chart Library
// ============================================

class MiniChart {
    constructor(canvas, options = {}) {
        this.canvas = typeof canvas === 'string' ? document.getElementById(canvas) : canvas;
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.options = {
            type: options.type || 'bar',
            padding: options.padding || { top: 30, right: 20, bottom: 40, left: 50 },
            colors: options.colors || ['#00d4ff', '#7c3aed', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6'],
            bgColor: options.bgColor || 'transparent',
            gridColor: options.gridColor || 'rgba(42, 42, 58, 0.5)',
            textColor: options.textColor || '#8888a0',
            fontSize: options.fontSize || 10,
            animate: options.animate !== false,
            barRadius: options.barRadius || 4,
            lineWidth: options.lineWidth || 2,
            ...options
        };
        this.data = null;
        this.animProgress = 0;
        this.animId = null;
        this.setupHiDPI();
    }

    setupHiDPI() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.width = rect.width;
        this.height = rect.height;
    }

    setData(data) {
        this.data = data;
        if (this.options.animate) {
            this.animProgress = 0;
            this.animate();
        } else {
            this.animProgress = 1;
            this.render();
        }
    }

    animate() {
        if (this.animId) cancelAnimationFrame(this.animId);
        const duration = 800;
        const start = performance.now();
        const tick = (now) => {
            const elapsed = now - start;
            this.animProgress = Math.min(elapsed / duration, 1);
            this.animProgress = this.easeOutCubic(this.animProgress);
            this.render();
            if (this.animProgress < 1) {
                this.animId = requestAnimationFrame(tick);
            }
        };
        this.animId = requestAnimationFrame(tick);
    }

    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    render() {
        if (!this.data) return;
        const ctx = this.ctx;
        const { padding } = this.options;

        ctx.clearRect(0, 0, this.width, this.height);

        if (this.options.bgColor !== 'transparent') {
            ctx.fillStyle = this.options.bgColor;
            ctx.fillRect(0, 0, this.width, this.height);
        }

        switch (this.options.type) {
            case 'bar': this.renderBar(); break;
            case 'line': this.renderLine(); break;
            case 'horizontalBar': this.renderHorizontalBar(); break;
        }
    }

    renderBar() {
        const ctx = this.ctx;
        const { padding, colors, gridColor, textColor, fontSize, barRadius } = this.options;
        const { labels, datasets } = this.data;

        const chartW = this.width - padding.left - padding.right;
        const chartH = this.height - padding.top - padding.bottom;

        const allValues = datasets.flatMap(d => d.data);
        const maxVal = Math.max(...allValues) * 1.1 || 1;

        // Grid lines
        const gridLines = 5;
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 0.5;
        ctx.font = `${fontSize}px Inter, sans-serif`;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'right';

        for (let i = 0; i <= gridLines; i++) {
            const y = padding.top + (chartH / gridLines) * i;
            const val = Math.round(maxVal - (maxVal / gridLines) * i);
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(this.width - padding.right, y);
            ctx.stroke();
            ctx.fillText(val, padding.left - 8, y + 4);
        }

        // Bars
        const dsCount = datasets.length;
        const groupWidth = chartW / labels.length;
        const barWidth = Math.min((groupWidth * 0.7) / dsCount, 40);
        const groupPad = (groupWidth - barWidth * dsCount) / 2;

        datasets.forEach((ds, di) => {
            const color = ds.color || colors[di % colors.length];
            ds.data.forEach((val, i) => {
                const barH = (val / maxVal) * chartH * this.animProgress;
                const x = padding.left + i * groupWidth + groupPad + di * barWidth;
                const y = padding.top + chartH - barH;

                ctx.fillStyle = color;
                this.roundRect(x, y, barWidth - 2, barH, barRadius);
            });
        });

        // Labels
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.font = `${fontSize}px Inter, sans-serif`;
        labels.forEach((label, i) => {
            const x = padding.left + i * groupWidth + groupWidth / 2;
            const y = this.height - padding.bottom + 16;
            ctx.fillText(this.truncate(label, 12), x, y);
        });
    }

    renderLine() {
        const ctx = this.ctx;
        const { padding, colors, gridColor, textColor, fontSize, lineWidth } = this.options;
        const { labels, datasets } = this.data;

        const chartW = this.width - padding.left - padding.right;
        const chartH = this.height - padding.top - padding.bottom;

        const allValues = datasets.flatMap(d => d.data);
        const maxVal = Math.max(...allValues) * 1.1 || 1;

        // Grid
        const gridLines = 5;
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 0.5;
        ctx.font = `${fontSize}px Inter, sans-serif`;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'right';

        for (let i = 0; i <= gridLines; i++) {
            const y = padding.top + (chartH / gridLines) * i;
            const val = Math.round(maxVal - (maxVal / gridLines) * i);
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(this.width - padding.right, y);
            ctx.stroke();
            ctx.fillText(val, padding.left - 8, y + 4);
        }

        // Lines
        datasets.forEach((ds, di) => {
            const color = ds.color || colors[di % colors.length];
            const points = ds.data.map((val, i) => ({
                x: padding.left + (i / (labels.length - 1)) * chartW,
                y: padding.top + chartH - (val / maxVal) * chartH * this.animProgress
            }));

            // Area
            ctx.beginPath();
            ctx.moveTo(points[0].x, padding.top + chartH);
            points.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
            ctx.closePath();
            const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
            grad.addColorStop(0, color + '30');
            grad.addColorStop(1, color + '05');
            ctx.fillStyle = grad;
            ctx.fill();

            // Line
            ctx.beginPath();
            points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.stroke();

            // Dots
            points.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
                ctx.fillStyle = '#0a0a0f';
                ctx.fill();
            });
        });

        // Labels
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        labels.forEach((label, i) => {
            const x = padding.left + (i / (labels.length - 1)) * chartW;
            ctx.fillText(this.truncate(label, 8), x, this.height - padding.bottom + 16);
        });
    }

    renderHorizontalBar() {
        const ctx = this.ctx;
        const { padding, colors, gridColor, textColor, fontSize, barRadius } = this.options;
        const { labels, datasets } = this.data;

        const chartW = this.width - padding.left - padding.right;
        const chartH = this.height - padding.top - padding.bottom;

        const allValues = datasets.flatMap(d => d.data);
        const maxVal = Math.max(...allValues) * 1.1 || 1;

        const barHeight = Math.min(chartH / labels.length * 0.7, 25);
        const gap = chartH / labels.length;

        datasets.forEach((ds, di) => {
            const color = ds.color || colors[di % colors.length];
            ds.data.forEach((val, i) => {
                const barW = (val / maxVal) * chartW * this.animProgress;
                const y = padding.top + i * gap + (gap - barHeight) / 2;

                ctx.fillStyle = color;
                this.roundRect(padding.left, y, barW, barHeight, barRadius);

                // Value
                ctx.fillStyle = textColor;
                ctx.font = `${fontSize}px JetBrains Mono, monospace`;
                ctx.textAlign = 'left';
                ctx.fillText(`${val}ms`, padding.left + barW + 8, y + barHeight / 2 + 4);
            });
        });

        // Labels
        ctx.fillStyle = textColor;
        ctx.textAlign = 'right';
        ctx.font = `${fontSize}px Inter, sans-serif`;
        labels.forEach((label, i) => {
            const y = padding.top + i * gap + gap / 2 + 4;
            ctx.fillText(this.truncate(label, 15), padding.left - 8, y);
        });
    }

    roundRect(x, y, w, h, r) {
        const ctx = this.ctx;
        if (h <= 0 || w <= 0) return;
        r = Math.min(r, h / 2, w / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();
    }

    truncate(str, max) {
        return str.length > max ? str.substring(0, max - 1) + '…' : str;
    }

    destroy() {
        if (this.animId) cancelAnimationFrame(this.animId);
    }
}

window.MiniChart = MiniChart;