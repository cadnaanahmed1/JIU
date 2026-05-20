require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Admin Schema
const adminSchema = new mongoose.Schema({
    username: String,
    password: String,
    role: {
        type: String,
        default: "admin"
    }
});

const Admin = mongoose.model("Admin", adminSchema);

// Connect MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.log(err));

const seedAdmin = async () => {
    try {

        // check admin exists
        const existingAdmin = await Admin.findOne({
            username: "jiu2013"
        });

        if (existingAdmin) {
            console.log("Admin already exists");
            process.exit();
        }

        // hash password
        const hashedPassword = await bcrypt.hash("jiu20130907753990klo", 10);

        // create admin
        const admin = new Admin({
            username: "jiu2013",
            password: hashedPassword
        });

        await admin.save();

        console.log("Default admin created!");
        console.log("Username: jiu2013");
        console.log("Password: jiu20130907753990klo");

        process.exit();

    } catch (err) {
        console.log(err);
        process.exit(1);
    }
};

seedAdmin();