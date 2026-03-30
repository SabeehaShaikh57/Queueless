require("dotenv").config();
const express = require("express");
const cors = require("cors");

const http = require("http");
const { Server } = require("socket.io");

const db = require("./config/db");
const { seedAdminFromEnv } = require("./utils/seedAdmin");
const { seedBusinessesFromJson } = require("./utils/seedBusinesses");

const authRoutes = require("./routes/authRoutes");
const businessRoutes = require("./routes/businessRoutes");
const queueRoutes = require("./routes/queueRoutes");
const voiceRoutes = require("./routes/voiceRoutes");
const faqRoutes = require("./routes/faqRoutes");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
app.set("io", io);

app.use(cors());
app.use(express.json());

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

app.get("/", (req,res)=>{
    res.send("QueueLess Backend Running");
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

server.listen(PORT, ()=>{
    console.log("Server running on port " + PORT);
});
