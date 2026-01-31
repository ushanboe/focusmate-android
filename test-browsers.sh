#!/bin/bash
# FocusMate AI - Browser Test Launcher
# Use this script to test in different browsers

SERVER_URL="http://localhost:5173"

echo "🧩 FocusMate AI - Browser Test Launcher"
echo "======================================="
echo ""
echo "Dev server running at: $SERVER_URL"
echo ""

# Detect available browsers
CHROME_AVAILABLE=0
EDGE_AVAILABLE=0
FIREFOX_AVAILABLE=0

if command -v google-chrome &> /dev/null; then
    CHROME_AVAILABLE=1
fi

if command -v microsoft-edge &> /dev/null; then
    EDGE_AVAILABLE=1
fi

if command -v firefox &> /dev/null; then
    FIREFOX_AVAILABLE=1
fi

# Menu
echo "Available browsers:"
if [ $CHROME_AVAILABLE -eq 1 ]; then
    echo "  1) Chrome (best for WebGPU)"
fi
if [ $EDGE_AVAILABLE -eq 1 ]; then
    echo "  2) Edge (good for WebGPU)"
fi
if [ $FIREFOX_AVAILABLE -eq 1 ]; then
    echo "  3) Firefox (no WebGPU support)"
fi
echo "  4) All browsers"
echo "  q) Quit"
echo ""
read -p "Select browser: " choice

case $choice in
    1)
        if [ $CHROME_AVAILABLE -eq 1 ]; then
            echo "Opening Chrome..."
            google-chrome "$SERVER_URL" &
        else
            echo "Chrome not found"
        fi
        ;;
    2)
        if [ $EDGE_AVAILABLE -eq 1 ]; then
            echo "Opening Edge..."
            microsoft-edge "$SERVER_URL" &
        else
            echo "Edge not found"
        fi
        ;;
    3)
        if [ $FIREFOX_AVAILABLE -eq 1 ]; then
            echo "Opening Firefox..."
            firefox "$SERVER_URL" &
        else
            echo "Firefox not found"
        fi
        ;;
    4)
        echo "Opening all browsers..."
        if [ $CHROME_AVAILABLE -eq 1 ]; then
            google-chrome "$SERVER_URL" &
        fi
        if [ $EDGE_AVAILABLE -eq 1 ]; then
            sleep 1
            microsoft-edge "$SERVER_URL" &
        fi
        if [ $FIREFOX_AVAILABLE -eq 1 ]; then
            sleep 1
            firefox "$SERVER_URL" &
        fi
        ;;
    q|Q)
        echo "Quitting..."
        exit 0
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "✓ Browser(s) launched"
echo ""
echo "Don't forget to:"
echo "  - Open browser console (F12) to see debug logs"
echo "  - For Chrome/Edge: Enable WebGPU at chrome://flags/#enable-unsafe-webgpu"
echo "  - Read DEV-GUIDE.md for full instructions"