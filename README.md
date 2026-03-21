# Queueless (v5) 🎫
### Skip the Wait — Real-time Virtual Queue Management System

A **full-stack** queue management platform with professional frontend (Vanilla JS) and powerful Node.js/Express backend. Works in **demo mode** without a backend, and seamlessly connects to MongoDB backend for persistent real-time operations.

**Current Status:** Fully functional with live FAQ system, queue history logging, and admin controls ✅

---

## 📁 Project Structure

```
ql_v5/
│
├── queueless-frontend/
│   ├── index.html              ← Main HTML (open in browser)
│   ├── css/
│   │   └── styles.css          ← All styles, design tokens, responsive
│   └── js/
│       └── app.js              ← All frontend logic, API calls, Socket.IO
│
├── queueless-backend/
│   ├── server.js               ← Express + Socket.IO server
│   ├── package.json            ← Node dependencies
│   ├── config/
│   │   └── db.js               ← MongoDB connection
│   ├── models/
│   │   ├── User.js             ← User schema
│   │   ├── Business.js         ← Business schema
│   │   ├── Token.js            ← Queue token schema
│   │   └── Faq.js              ← FAQ schema (✨ new)
│   ├── controllers/
│   │   ├── authController.js   ← Register/Login logic
│   │   ├── businessController.js ← Business CRUD
│   │   ├── queueController.js  ← Queue operations (join, next, moveUp, etc.)
│   │   └── faqController.js    ← FAQ CRUD (✨ new)
│   └── routes/
│       ├── authRoutes.js
│       ├── businessRoutes.js
│       ├── queueRoutes.js
│       └── faqRoutes.js        ← FAQ API routes (✨ new)
│
└── README.md                   ← You are here
```

---

## 🚀 How to Use

### Option 1 — Demo Mode (No Backend Required)
```bash
# Frontend-only, works with built-in demo data
1. Open queueless-frontend/index.html in any modern browser
2. Try both Customer and Admin dashboards
3. All features work offline with simulated data
```

### Option 2 — Full-Stack with Live Backend
```bash
# Start MongoDB (required)
# Ensure MongoDB is running locally or provide connection string in config/db.js

# Terminal 1: Start backend (port 5000)
cd queueless-backend
npm install
npm run dev

# Terminal 2: Serve frontend  
cd queueless-frontend
# Open index.html in browser (or use VS Code Live Server extension)

# Frontend auto-detects backend and switches from demo → live mode
```

---

## 🔑 Demo Accounts

| Role     | Email/Password | How to Access |
|----------|---|---|
| **Customer** | Any email + password | Click "Customer" tab, enter any credentials |
| **Admin** | Any email + password | Click "Admin" tab, enter any credentials |

**Note:** In demo mode, data is browser-local. With backend running, all data persists in MongoDB.

---

## ✨ Key Features

### 👥 Customer Dashboard
| Feature | Status | Description |
|---------|:------:|-------------|
| Browse Businesses | ✅ | See all queues with wait times |
| Join Queue | ✅ | Get token, live position tracking |
| Live Updates | ✅ | Real-time position/status via Socket.IO |
| My Token | ✅ | Hero card with position, ETA, cancel option |
| Queue History | ✅ | Past tokens with completion status |
| FAQ | ✅ | Ask questions, see admin answers in real-time |
| Notifications | ✅ | Desktop alerts when token called |
| Profile | ✅ | Edit name, email, phone |
| Voice Commands | ✅ | "Join queue", "My position", "Cancel token" (via WebRTC) |

### 🛡️ Admin Dashboard  
| Feature | Status | Description |
|---------|:------:|-------------|
| Queue Overview | ✅ | Real-time stats + full customer list |
| Call Next Token | ✅ | Advance queue, notify customer |
| Skip Token | ✅ | Mark token skipped, log reason |
| Move Token | ✅ | Reorder queue, prioritize customers |
| Remove Token | ✅ | Delete from queue |
| Add Walk-In | ✅ | Manually add customer without token |
| Queue History | ✅ | **NEW**: Live log of all actions (join, skip, remove, etc.) |
| FAQ Management | ✅ | **NEW**: Answer customer questions, real-time delivery |
| Audio Announce | ✅ | Browser TTS: "Token 15, proceed to counter" |
| Business Mgmt | ✅ | Register business, add services, set hours |
| Analytics | ✅ | Wait time trends, hourly charts, weekly summary |
| Delay/Pause | ✅ | Pause queue, broadcast to all customers |
| Notifications | ✅ | Send alerts, templates, bulk broadcast |

---

## � Backend API Endpoints

### Authentication
| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/api/auth/register` | `{email, password, name, role}` | `{token, user}` |
| POST | `/api/auth/login` | `{email, password}` | `{token, user}` |

### Business Management
| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| GET | `/api/business/list` | — | `[{id, name, type, ...}]` |
| POST | `/api/business/create` | `{name, type, address, hours}` | `{business}` |
| POST | `/api/business/service` | `{businessId, serviceName, estTime}` | `{updated}` |

### Queue Operations
| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/api/queue/join` | `{businessId, customerName, service}` | `{tokenId, position, waitTime}` |
| GET | `/api/queue/status/:businessId` | — | `{queue: [{tokenId, position, status}]}` |
| POST | `/api/queue/next` | `{businessId}` | `{nextToken}` or 404 if empty |
| POST | `/api/queue/skip` | `{businessId, tokenId}` | `{updated}` |
| POST | `/api/queue/move-up` | `{businessId, tokenId, newPosition}` | `{updated}` |
| POST | `/api/queue/complete` | `{businessId, tokenId}` | `{updated}` |
| POST | `/api/queue/remove` | `{businessId, tokenId}` | `{updated}` |

### FAQ System (✨ NEW)
| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| GET | `/api/faq/list` | — | `[{id, question, askedBy, answer, answered}]` |
| POST | `/api/faq/create` | `{question, askedBy}` | `{faq}` |
| POST | `/api/faq/:id/answer` | `{answer}` | `{updated}` |

---

## 🔄 Real-Time Features (Socket.IO)

### Server → Client Events
```javascript
// Queue updates
socket.on('token_joined', {tokenId, position, customerName})
socket.on('token_called', {tokenId, position})
socket.on('token_skipped', {tokenId, reason})
socket.on('token_removed', {tokenId})
socket.on('queue_updated', {businessId, queue})

// FAQ (✨ NEW)
socket.on('faq_submitted', {question, askedBy, timestamp})
socket.on('faq_answered', {faqId, answer, answeredAt})

// Alerts
socket.on('queue_paused', {reason, duration})
socket.on('delay_announced', {reason, minutes})
socket.on('notification', {message, type})
```

### Client → Server Events
```javascript
socket.emit('faq_submitted', {question, askedBy})
socket.emit('faq_answered', {faqId, answer})
socket.emit('queue_action', {action, tokenId})
```

---

## 🛠️ Tech Stack

### Frontend
- **HTML5** — Semantic markup, modal dialogs, forms
- **CSS3** — Custom properties, Grid, Flexbox, animations, responsive
- **Vanilla JavaScript** — ES6+, no frameworks/dependencies
- **Socket.IO Client** — Real-time queue updates
- **localStorage** — Client-side state persistence

### Backend
- **Node.js** — Server runtime
- **Express.js** — Web framework, routing, middleware
- **MongoDB** — NoSQL database (Mongoose ORM)
- **Socket.IO Server** — Real-time bidirectional communication
- **bcryptjs** — Password hashing
- **jsonwebtoken (JWT)** — Token-based authentication

### Database Schema
```javascript
// User
{ email, password (hashed), name, role (customer/admin), phone, photo, createdAt }

// Business  
{ name, type (hospital/bank/clinic/etc), address, city, hours, services: [{name, estTime}] }

// Token
{ businessId, customerName, service, status (waiting/serving/completed/skipped/removed), 
  position, joinedAt, calledAt, completedAt }

// FAQ (✨ NEW)
{ question, askedBy, answer, answeredAt, createdAt }
```

---

## 🐛 Recent Fixes & Improvements (v5)

✅ **Fixed admin action buttons** — Skip, Remove, Move Up, Mark Complete now work correctly  
✅ **Live Queue History** — All actions logged with timestamps and statuses  
✅ **Backend FAQ System** — Persistent storage in MongoDB + real-time socket delivery  
✅ **String-safe ID handling** — Proper Mongo ObjectId comparisons throughout  
✅ **Join Queue flow** — Modal properly resolves business details  
✅ **Error recovery** — Better handling of empty queues, missing data  

---

## 🚦 Getting Started (Quick Start)

### Prerequisites
- Node.js (v14+)
- MongoDB (local or Atlas connection string)
- Modern browser (Chrome, Firefox, Safari, Edge)

### Backend Setup
```bash
cd queueless-backend
npm install
# Create .env or update config/db.js with MongoDB connection
npm run dev  # Starts on http://localhost:5000
```

### Frontend Setup
```bash
cd queueless-frontend
# Option A: Use VS Code Live Server extension
# Right-click index.html → "Open with Live Server"

# Option B: Use Python SimpleHTTPServer (if Python installed)
python -m http.server 3000

# Option C: Just open index.html directly in browser (works fully in demo mode)
```

### Verify Connection
1. Open browser console (F12)
2. Frontend should log: `"Connected to backend"` or `"Running in demo mode"`
3. Try joining a queue — should persist if backend running

---

## 🎯 Common Tasks

### Join Queue as Customer
1. Click "Customer" tab
2. Browse businesses → click "Join Queue"
3. Enter name, phone (optional)
4. Get token, track position in real-time

### Call Next Token (Admin)
1. Click "Admin" tab → "Queue Management"
2. Click "Call Next" button
3. Customer receives notification, moves to "Serving"
4. History auto-logs the action

### Answer Customer FAQ (Admin)
1. Click "Admin" tab → "FAQ" section
2. See customer questions
3. Click answer field, type response, save
4. Customer sees answer immediately (via Socket.IO)

### View Queue History (Admin)
1. Click "Admin" tab → "Queue History"
2. See all actions: Join, Call Next, Skip, Remove, Complete
3. Filter by date or business

---

## 📝 Notes

- **Demo Mode:** Frontend works completely standalone with simulated data
- **Auto-Detection:** When backend is available, frontend automatically switches to live mode
- **Real-time Sync:** Both customer and admin dashboards update instantly via Socket.IO
- **State Persistence:** Backend uses MongoDB; frontend uses localStorage as fallback
- **Error Handling:** Network errors gracefully fall back to demo data

---

## 🤝 Contributing

This is a teaching/demo project. For questions or improvements, refer to the code comments.

---

## 📄 License

Open source / Educational use
- **Web Speech API** — Voice assistant + audio announcements

---

## 📱 Browser Support

| Browser | Support |
|---------|---------|
| Chrome 90+ | ✅ Full (including Voice) |
| Edge 90+ | ✅ Full (including Voice) |
| Firefox 90+ | ✅ (Voice not supported) |
| Safari 14+ | ✅ (Voice limited) |
| Mobile Chrome | ✅ Full |

---

## ⚙️ Configuration

To change the backend URL, edit line 4 in `js/app.js`:
```js
const API = 'http://localhost:5000/api';
```
Replace with your server URL when deploying.

---

## 📄 License
Built for Queueless. All rights reserved.
