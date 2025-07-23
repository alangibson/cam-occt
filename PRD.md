# CAM-OCCT Product Requirements Document

## Executive Summary

CAM-OCCT is a web-based Computer-Aided Manufacturing (CAM) application that converts SVG and DXF design files into optimized G-code for CNC plasma cutting operations. The application specifically targets LinuxCNC 2.9+ QtPlasmaC controllers.

## Product Overview

### Problem Statement
Metal fabricators and CNC plasma table operators currently face significant challenges in converting design files to production-ready G-code:
- Manual G-code generation is time-consuming and error-prone
- Suboptimal toolpaths lead to excessive material waste and longer cut times
- Inconsistent cut parameters result in poor edge quality and increased consumable costs
- Complex nesting operations require expensive specialized software
- Limited integration with LinuxCNC QtPlasmaC ecosystem

### Solution
CAM-OCCT addresses these pain points by providing an integrated web-based platform that automates the CAM workflow from design import to G-code export, with intelligent optimization algorithms specifically tuned for plasma cutting operations.

## Target Users

### Primary Users
- **Home Shop Hobbyists**: 
- **Small to Medium Metal Fabrication Shops**: 10-50 employee operations requiring efficient plasma cutting workflows
- **Independent CNC Plasma Operators**: Solo operators and small teams managing custom fabrication projects
- **Maker Spaces and Educational Institutions**: Organizations teaching CNC plasma cutting techniques

### User Personas
- **Production Manager Sarah**: Needs to maximize material utilization and minimize setup times across multiple daily jobs
- **CNC Operator Mike**: Requires reliable G-code that produces consistent cut quality with minimal manual intervention
- **Shop Owner David**: Wants to reduce software licensing costs while maintaining professional-grade capabilities

## Key Features

### Core Functionality

#### File Import and Processing
- **SVG File Support**: Full compatibility with industry-standard SVG files from CAD packages
- **DXF File Support**: Native DXF import with support for AutoCAD and other CAD system exports
- **Automatic Unit Conversion**: Intelligent detection and conversion between metric and imperial units
- **Layer Management**: Support for multi-layer files with selective processing capabilities

#### Intelligent Cut Optimization
- **Rapid Movement Optimization**: Minimizes non-cutting travel time through advanced pathfinding algorithms
- **Lead-in/Lead-out Automation**: Automatically generates appropriate entry and exit strategies based on geometry
- **Cut Sequencing**: Optimizes cutting order to minimize thermal distortion and improve part accuracy
- **Hole Detection and Processing**: Automatically identifies circular features and applies specialized hole-cutting parameters

#### LinuxCNC QtPlasmaC Integration
- **Native G-code Generation**: Produces LinuxCNC 2.9+ compatible G-code with QtPlasmaC-specific commands
- **Cutting Parameter Management**: Integrates with QtPlasmaC material databases for automatic parameter selection
- **Torch Height Control**: Generates appropriate THC commands for optimal cut quality
- **Consumable Optimization**: Balances cutting speed and quality to maximize consumable life

#### Material Nesting and Optimization
- **Automatic Part Nesting**: Intelligent algorithms pack parts onto material sheets to minimize waste
- **Manual Nesting Override**: Drag-and-drop interface for user-controlled part placement
- **Material Database**: Pre-configured templates for common sheet sizes and materials
- **Waste Calculation**: Real-time feedback on material utilization efficiency

#### Simulation and Verification
- **Cut Path Visualization**: 3D preview of cutting operations with timing estimates
- **Collision Detection**: Identifies potential torch crashes or material interference
- **Consumable Life Prediction**: Estimates pierces and cut time for maintenance planning
- **Quality Assurance**: Highlights potential cut quality issues before production

#### Basic CAD Functionality
- **Shape Deletion**: Remove unwanted geometry elements from imported files
- **Part Repositioning**: Drag-and-drop interface for manual part placement
- **Scaling Operations**: Resize parts while maintaining geometric integrity
- **Rotation and Mirroring**: Basic transformation tools for part orientation

### Technical Specifications

#### System Requirements
- **Platform**: Web-based application accessible via modern browsers
- **Browser Compatibility**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Performance**: Optimized for files up to 10MB with 1000+ geometric entities
- **Offline Capability**: Progressive Web App (PWA) support for offline operation

#### File Format Support
- **SVG**: Full SVG 1.1 specification compliance
- **DXF**: AutoCAD DXF versions R12 through 2021
- **Export**: LinuxCNC G-code (.ngc), standard G-code (.gcode), SVG, DXF

#### Integration Capabilities
- **LinuxCNC Integration**: Direct compatibility with LinuxCNC 2.9+ and QtPlasmaC
- **Custom Integration**: User-added compatability with other CNC controllers via post-processor configuration
- **CAD Software Export**: Direct export plugins for popular CAD packages (future enhancement)
- **Cloud Storage**: Integration with Google Drive, Dropbox for file management

## Technical Architecture

### Frontend Technology Stack
- **Framework**: Svelte 5 with TypeScript for type safety
- **UI Library**: Tailwind CSS for consistent design system
- **Graphics**: Three.js for 3D visualization and simulation
- **Geometry**: OpenCascade.js for core CAD geometry calculations
- **File Processing**: Web Workers for heavy computational tasks

### Backend Services
- **API Framework**: Node.js with sveltekit
- **Database**: PostgreSQL for user data
- **Authentication**: OAuth 2.0 with support for Google, GitHub accounts

### Core Algorithms
- **Nesting Engine**: Custom implementation using genetic algorithms or simulated annealing
- **Path Optimization**: Traveling Salesman Problem (TSP) solver 
- **Geometry Processing**: OpenCascade.js for shape analysis and manipulation

## User Experience Design

### Workflow Design
1. **Import**: Drag-and-drop interface
2. **Edit**: Basic editing of drawing
3. **Program**: Apply cut path operations to drawing shapes. One-click optimization with progress feedback
4. **Simulate**: Interactive preview with manual override capabilities
5. **Export**: Single-click G-code generation with download options

### Interface Principles
- **Simplicity**: Clean, uncluttered interface focusing on essential functions
- **Visual Feedback**: Real-time preview of all operations and changes
- **Progressive Disclosure**: Advanced features available but not overwhelming for basic users

## Development Phases

### Phase 1: Core MVP
- Basic SVG/DXF import functionality
- Basic drawing editing functions
- Basic cut path optimization
- Simple G-code generation for LinuxCNC

### Phase 2: Optimization Features
- Advanced nesting algorithms
- Hole detection and specialized processing
- Cut simulation and visualization
- Material database integration

### Phase 3: Advanced Features
- Real-time collaboration capabilities
- Advanced CAD editing tools
- Plugin architecture for extensibility
- Mobile application development

### Phase 4: Enterprise Features
- Multi-user management and permissions
- Advanced reporting and analytics
- API for third-party integrations
- White-label licensing options

## Risk Assessment

### Technical Risks
- **Browser Performance**: Complex geometry processing may strain browser capabilities
- **File Compatibility**: Variations in SVG/DXF implementations across CAD systems
- **Algorithm Complexity**: Nesting and optimization algorithms may be computationally intensive

### Mitigation Strategies
- Progressive loading and Web Worker utilization for performance optimization
- Comprehensive testing suite with files from major CAD packages
- Fallback algorithms and user override options for complex optimization scenarios

### Market Risks
- **Competition**: Established CAM software vendors with extensive feature sets
- **User Adoption**: Resistance to web-based tools in traditional manufacturing environments
- **Technical Support**: Providing adequate support for diverse CNC configurations

## Competitive Analysis

### Direct Competitors
- **SheetCAM**: Established desktop application with strong LinuxCNC integration
- **Inkscape**: Vector editor with Gcode plugin

