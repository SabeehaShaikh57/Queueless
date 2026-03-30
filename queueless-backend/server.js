require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const http = require("http");
const { Server } = require("socket.io");

const { mongoose, connectDB } = require("./config/db");
const { seedAdminFromEnv } = require("./utils/seedAdmin");
const { seedBusinessesFromJson } = require("./utils/seedBusinesses");

const authRoutes = require("./routes/authRoutes");
const businessRoutes = require("./routes/businessRoutes");
const queueRoutes = require("./routes/queueRoutes");
const voiceRoutes = require("./routes/voiceRoutes");
const faqRoutes = require("./routes/faqRoutes");

const app = express();
const server = http.createServer(app);

const configuredOrigins = String(process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const isAllowedOrigin = (origin) => {
    if (!origin) return true;
    if (configuredOrigins.length === 0) return true;
    return configuredOrigins.includes(origin);
};

const corsConfig = {
    origin(origin, callback) {
        if (isAllowedOrigin(origin)) {
            return callback(null, true);
        }
        return callback(new Error("CORS origin not allowed"));
    },
    credentials: true,
};

const io = new Server(server, { cors: corsConfig });
app.set("io", io);

app.disable("x-powered-by");
app.use(cors(corsConfig));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const frontendDir = path.resolve(__dirname, "../queueless-frontend");
const frontendIndex = path.join(frontendDir, "index.html");
const requestedFrontendServe = String(process.env.SERVE_FRONTEND || "true").toLowerCase() !== "false";
const serveFrontend = requestedFrontendServe && fs.existsSync(frontendIndex);

if (serveFrontend) {
    app.use(express.static(frontendDir));
}

app.use("/api/auth", authRoutes);
app.use("/api/business", businessRoutes);
app.use("/api/queue", queueRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api/faq", faqRoutes);

seedAdminFromEnv().catch((error) => {
    console.error("Admin seed failed", error);
});

seedBusinessesFromJson().catch((error) => {
    console.error("Businesses seed failed", error);
});

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        uptime: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
        dbState: mongoose.connection.readyState,
    });
});

app.get("/", (req,res)=>{
    if (serveFrontend) {
        return res.sendFile(frontendIndex);
    }
    return res.send("QueueLess Backend Running");
});

io.on("connection",(socket)=>{
    console.log("Client connected");

    socket.on("queue_update", (payload = {}) => {
        io.emit("queue_update", payload);
    });

    socket.on("queue_called", (payload = {}) => {
        io.emit("queue_update", payload);
        io.emit("notification", {
            title: "Token Called",
            message: payload?.token ? `Token #${payload.token} is now being served.` : "A new token is now being served.",
        });
    });

    socket.on("admin_notify", (payload = {}) => {
        io.emit("notification", {
            title: "Admin Notification",
            message: payload?.message || "You have an update from the business.",
            token: payload?.token,
            business_id: payload?.biz,
        });
    });

    socket.on("admin_broadcast", (payload = {}) => {
        io.emit("notification", {
            title: "Broadcast",
            message: payload?.message || "New broadcast from business.",
            business_id: payload?.biz,
        });
    });

    socket.on("queue_paused", (payload = {}) => {
        io.emit("queue_paused", payload);
    });

    socket.on("queue_delayed", (payload = {}) => {
        io.emit("queue_delayed", payload);
    });

    socket.on("faq_submitted", (payload = {}) => {
        io.emit("faq_submitted", payload);
    });

    socket.on("faq_answered", (payload = {}) => {
        io.emit("faq_answered", payload);
    });

    socket.on("disconnect",()=>{
        console.log("Client disconnected");
    });
});

const PORT = process.env.PORT || 5000;

async function start() {
    if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
        console.error("JWT_SECRET is required in production");
        process.exit(1);
    }

    await connectDB();
    server.listen(PORT, () => {
        console.log("Server running on port " + PORT);
    });
}

start();

function shutdown(signal) {
    console.log(`${signal} received. Shutting down server...`);
    server.close(() => {
        mongoose.connection.close(false).finally(() => {
            process.exit(0);
        });
    });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
