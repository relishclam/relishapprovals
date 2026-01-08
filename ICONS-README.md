# PWA Icon Generation Instructions

## Required Icons for Relish Approvals PWA

You need to generate the following icon sizes from your Relish Foods logo:

### Required Sizes:
- icon-72.png (72x72)
- icon-96.png (96x96)
- icon-128.png (128x128)
- icon-144.png (144x144)
- icon-152.png (152x152)
- icon-192.png (192x192) - Required for Add to Home Screen
- icon-384.png (384x384)
- icon-512.png (512x512) - Required for splash screen

### How to Generate:

#### Option 1: Online Tools (Easiest)
1. Visit: https://www.pwabuilder.com/imageGenerator
2. Upload your Relish logo (square, transparent background, at least 512x512px)
3. Download all generated sizes
4. Place them in: public/ folder

#### Option 2: Using Photoshop/GIMP
1. Open your logo
2. Export each size listed above
3. Save as PNG with transparency
4. Name files exactly as listed above

#### Option 3: Using ImageMagick (Command Line)
```bash
# Install ImageMagick first
# Then run:
convert logo.png -resize 72x72 icon-72.png
convert logo.png -resize 96x96 icon-96.png
convert logo.png -resize 128x128 icon-128.png
convert logo.png -resize 144x144 icon-144.png
convert logo.png -resize 152x152 icon-152.png
convert logo.png -resize 192x192 icon-192.png
convert logo.png -resize 384x384 icon-384.png
convert logo.png -resize 512x512 icon-512.png
```

### Temporary Placeholder
Until you generate proper icons, the app will use the existing logo.png
But for full PWA functionality, generate these icons ASAP!

### Design Guidelines:
- Use your Relish Foods logo
- Square aspect ratio (equal width and height)
- Transparent or white background
- Ensure logo is centered with some padding
- Colors should match Relish brand (orange #f5841f, purple #7b4b94)
