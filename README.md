# Echo Location Game - VR Edition

This is a WebXR-based echo location game where the world is dark until you emit sound waves that temporarily reveal your surroundings.

## Setup for Oculus Quest 2

### Prerequisites

1. An Oculus Quest 2 headset with Developer Mode enabled
2. Node.js installed on your computer
3. Computer and Quest 2 on the same WiFi network

### Installation

1. Clone this repository
2. Install the required packages:
   ```
   npm install express https fs path
   ```
3. Generate SSL certificates (required for WebXR):
   ```bash
   openssl genrsa -out key.pem
   openssl req -new -key key.pem -out csr.pem
   openssl x509 -req -days 365 -in csr.pem -signkey key.pem -out cert.pem
   ```

### Running the Game

1. Start the HTTPS server:
   ```
   node server.js
   ```
2. Find your computer's local IP address (e.g., 192.168.1.X)
3. On your Oculus Quest 2, open the Oculus Browser and navigate to:
   ```
   https://YOUR_IP_ADDRESS:3000
   ```
4. Accept the security warning about the self-signed certificate
5. Click the "Enter VR" button that appears on the page

## Controls

### VR Mode (Oculus Quest 2)
- **Left Controller Thumbstick**: Move around
- **Right Controller Trigger**: Emit echo to reveal surroundings
- **Grip Buttons**: Currently unused, can be customized

### Desktop Mode
- **WASD**: Movement
- **Mouse**: Look around
- **Spacebar**: Emit echo to reveal surroundings

## Game Mechanics

- The world is dark until you emit an echo
- Echo waves travel outward and temporarily reveal the environment
- Collect power-ups to enhance your echo abilities
- Navigate the maze by creating echoes to see your surroundings

## Development Notes

- Uses Three.js for 3D rendering
- WebXR API for VR support
- Custom particle system for echo wave visualization
- Supports both VR and non-VR gameplay

## Troubleshooting

- If you can't connect from Quest 2, ensure both devices are on the same network
- If WebXR doesn't work, verify that Developer Mode is enabled on your Quest 2
- Browser security warnings are normal with self-signed certificates 