# RailSafe Alert - System Architecture & UML Diagrams

This document contains the structural and behavioral diagrams for the RailSafe Alert system.

## 1. System Architecture

```mermaid
graph TD
    subgraph Frontend [Web Browser / PWA]
        UI[React UI Components]
        Router[React Router]
        State[Local State Management]
        AlarmEngine[Smart Alarm Engine]
        APIService[API Integration Service]
        
        UI --> Router
        Router --> State
        UI --> AlarmEngine
        UI --> APIService
        
        subgraph WebAPIs [HTML5 / Browser APIs]
            GPS[Geolocation API]
            TTS[Web Speech API]
            VIB[Vibration API]
            NOT[Push Notifications API]
            AUDIO[HTML5 Audio]
        end
        
        AlarmEngine --> WebAPIs
    end

    subgraph Backend [Node.js Express Server]
        AuthRoutes[Authentication Routes]
        TrainRoutes[Train Search & Status Routes]
        JourneyRoutes[Journey Tracking Routes]
        
        APIService -->|HTTP GET/POST| AuthRoutes
        APIService -->|HTTP GET| TrainRoutes
        APIService -->|HTTP POST| JourneyRoutes
        
        subgraph Database [MySQL Database]
            UserTable[(Users)]
            JourneyTable[(Journeys)]
        end
        
        AuthRoutes --> UserTable
        JourneyRoutes --> JourneyTable
    end
```

## 2. Sequence Diagram: Smart Alarm Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Browser_APIs
    participant Backend

    User->>Frontend: Search for Train (e.g. 12951)
    Frontend->>Backend: GET /api/trains/search?query=12951
    Backend-->>Frontend: Return Train Data (with GPS Coords)
    
    User->>Frontend: Select Destination Station
    User->>Frontend: Set Target Alert Distance (e.g. 5km)
    User->>Frontend: Click "Start Tracking"
    
    loop Every Second
        Frontend->>Browser_APIs: Get Current Location (Simulated/GPS)
        Browser_APIs-->>Frontend: Return Lat/Lng
        Frontend->>Frontend: Calculate Haversine Distance to Destination
        
        alt Distance <= Target Alert Distance
            Frontend->>Browser_APIs: play() Audio
            Frontend->>Browser_APIs: vibrate()
            Frontend->>Browser_APIs: speechSynthesis.speak()
            Frontend->>Browser_APIs: show Notification()
            Frontend->>User: Display Flashing Red Screen
        end
    end
    
    User->>Frontend: Click "Stop Alarm"
    Frontend->>Browser_APIs: Cancel Audio, TTS, Vibration
```

## 3. Database Schema (ER Diagram)

```mermaid
erDiagram
    USERS {
        int id PK
        string name
        string email
        string password_hash
        datetime created_at
    }
    
    JOURNEYS {
        int id PK
        int user_id FK
        string trainNumber
        string trainName
        string source
        string destination
        string status
        datetime created_at
    }
    
    USERS ||--o{ JOURNEYS : "tracks"
```
