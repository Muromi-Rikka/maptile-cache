# MapTile Cache Service

A high-performance map tile caching service with multi-source support, built with TypeScript and Hono. Provides RESTful API endpoints for serving cached map tiles with automatic S3 storage and multi-map source configurations.

## Features

- 🗺️ **Multi-Map Source Support**: Support for multiple map sources with individual configurations
- ⚡ **High Performance**: Built with TypeScript and Hono for fast API responses
- 🏗️ **S3 Cache Storage**: Automatic caching to S3-compatible storage
- 🔄 **Load Balancing**: Subdomain rotation for map tile providers
- 📊 **Health Monitoring**: Built-in health check endpoints
- 🐳 **Docker Ready**: Complete Docker support with compose
- 🔧 **Configurable**: Easy configuration via JSON files

## Quick Start

### Local Development

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Access the service
open http://localhost:5000
```

### Docker Deployment

#### Using Docker Compose (Recommended)

1. **Create environment file**:
```bash
cat > .env << EOF
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET=your-bucket-name
S3_ENDPOINT=https://your-s3-endpoint.com
S3_REGION=us-east-1
S3_PREFIX=production
EOF
```

2. **Start the service**:
```bash
docker-compose up -d
```

#### Using Docker CLI

```bash
# Build the image
docker build -t maptile-cache .

# Run the container
docker run -d \
  --name maptile-cache \
  -p 5000:5000 \
  -e S3_ACCESS_KEY_ID=your-key \
  -e S3_SECRET_ACCESS_KEY=your-secret \
  -e S3_BUCKET=your-bucket \
  -e S3_ENDPOINT=https://s3-endpoint.com \
  -e S3_REGION=us-east-1 \
  -e S3_PREFIX=production \
  maptile-cache
```

## API Endpoints

### List Available Map Sources

```http
GET /maps
```

**Response:**
```json
{
  "maps": {
    "satellite": {
      "name": "Satellite",
      "description": "Satellite imagery tiles"
    },
    "terrain": {
      "name": "Terrain",
      "description": "Terrain with hillshade"
    }
  }
}
```

### Get Map Tile

```http
GET /tiles?source={source}&z={z}&x={x}&y={y}
```

**Parameters:**
- `source`: Map source identifier (e.g., "satellite", "terrain", "dark")
- `z`: Zoom level (0 or higher)
- `x`: X coordinate
- `y`: Y coordinate

**Examples:**
```
- Map tiles: http://localhost:5000/tiles?source=satellite&x=1&y=2&z=3
GET /tiles?source=terrain&z=10&x=535&y=320
GET /tiles?source=dark&z=8&x=134&y=87
```

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "maptile-cache",
  "version": "1.0.0",
  "availableSources": ["satellite", "terrain", "dark"]
}
```

## Configuration

### Map Sources Configuration

Map sources are defined in `config/maps.json`. Each source can have the following properties:

```json
{
  "maps": {
    "your-source": {
      "name": "Display Name",
      "description": "Description of the map source",
      "urlTemplate": "https://example.com/{z}/{x}/{y}.png",
      "cachePrefix": "custom-prefix",
      "subdomains": ["a", "b", "c"],
      "headers": {
        "User-Agent": "Custom Agent"
      }
    }
  }
}
```

### Configuration Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | ✅ | Display name of the map source |
| `description` | string | ✅ | Description for documentation |
| `urlTemplate` | string | ✅ | URL template with {z}, {x}, {y}, {s} placeholders |
| `cachePrefix` | string | ✅ | S3 cache prefix for this source |
| `subdomains` | string[] | ❌ | Subdomain list for load balancing |
| `headers` | object | ❌ | Additional HTTP headers |

### Default Map Sources

The service includes these pre-configured map sources:

1. **satellite** - Satellite imagery from ArcGIS
2. **terrain** - Terrain tiles from OpenTopoMap
3. **dark** - Dark themed tiles from CartoDB

## Environment Variables

### Required Variables
- `S3_ACCESS_KEY_ID`: S3 access key
- `S3_SECRET_ACCESS_KEY`: S3 secret key
- `S3_BUCKET`: S3 bucket name
- `S3_ENDPOINT`: S3 endpoint URL

### Optional Variables
- `S3_REGION`: S3 region (default: us-east-1)
- `S3_PREFIX`: S3 key prefix for cache organization (default: "tiles")
- `LOG_LEVEL`: Logging level (default: info)

## Cache Structure

Tiles are cached in S3 with the following structure:
```
s3://bucket-name/
├── satellite/
│   └── tiles/
│       └── {z}/
│           └── {x}/
│               └── {y}.png
├── terrain/
│   └── tiles/
│       └── {z}/
│           └── {x}/
│               └── {y}.png
└── dark/
    └── tiles/
        └── {z}/
            └── {x}/
                └── {y}.png
```

## Adding New Map Sources

1. Edit `config/maps.json`
2. Add new map source configuration
3. Restart the service
4. Access via `/tiles?source=new-source&z={z}&x={x}&y={y}`

## Development

### Scripts

- `bun run dev`: Start development server with hot reload
- `bun run start`: Start production server

### Development Setup

```bash
# Clone repository
git clone <repository-url>
cd maptile-cache

# Install dependencies
bun install

# Start development
bun run dev
```

### Configuration Files

- `config/maps.json`: Map source configurations
- `.env`: Environment variables (create from `.env.example`)
- `tsconfig.json`: TypeScript configuration
- `eslint.config.js`: ESLint configuration

## Architecture

### Tech Stack

- **Runtime**: Bun
- **Framework**: Hono
- **Language**: TypeScript
- **Storage**: S3-compatible storage
- **Logging**: Pino
- **Container**: Docker

### Key Components

1. **Cache Layer**: Automatic S3 caching with configurable prefixes
2. **Multi-Source Support**: Dynamic map source switching via query parameters
3. **Load Balancing**: Subdomain rotation for improved performance
4. **Health Monitoring**: Comprehensive health check endpoints
5. **Configuration Management**: JSON-based configuration system

## License

MIT License - see LICENSE file for details.
