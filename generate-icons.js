// Quick script to generate PWA icon PNGs using Canvas
// Run: node generate-icons.js

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, 'icons');

if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir);

sizes.forEach(size => {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#8b5cf6');
    gradient.addColorStop(1, '#6d28d9');

    // Full background
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    // Draw shopping bag icon
    ctx.save();
    ctx.translate(size / 2, size / 2);
    const s = size / 100;

    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 3 * s;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Bag top
    ctx.beginPath();
    ctx.moveTo(-20 * s, -14 * s);
    ctx.lineTo(-24 * s, -24 * s);
    ctx.lineTo(24 * s, -24 * s);
    ctx.lineTo(20 * s, -14 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Bag body
    ctx.beginPath();
    ctx.moveTo(-20 * s, -14 * s);
    ctx.lineTo(-20 * s, 24 * s);
    ctx.quadraticCurveTo(-20 * s, 28 * s, -16 * s, 28 * s);
    ctx.lineTo(16 * s, 28 * s);
    ctx.quadraticCurveTo(20 * s, 28 * s, 20 * s, 24 * s);
    ctx.lineTo(20 * s, -14 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Handle
    ctx.beginPath();
    ctx.arc(0, -14 * s, 10 * s, Math.PI, 0, false);
    ctx.stroke();

    // Checkmark
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4 * s;
    ctx.beginPath();
    ctx.moveTo(-8 * s, 8 * s);
    ctx.lineTo(-2 * s, 16 * s);
    ctx.lineTo(10 * s, 2 * s);
    ctx.stroke();

    ctx.restore();

    const buffer = canvas.toBuffer('image/png');
    const filePath = path.join(iconsDir, `icon-${size}x${size}.png`);
    fs.writeFileSync(filePath, buffer);
    console.log(`Created: icon-${size}x${size}.png`);
});

console.log('\nAll icons generated successfully!');
