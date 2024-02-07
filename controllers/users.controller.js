const asyncWrapper = require("../middleware/asyncWrapper");
const User = require('../models/user.model');
const httpStatusText = require('../utils/httpStatusText');
const appError = require('../utils/appError');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const generateJWT = require("../utils/generateJWT");

const getAllUsers = asyncWrapper(async(req, res) => {

    const query = req.query;

    const limit = query.limit || 10;
    const page = query.page || 1;
    const skip = (page - 1) * limit;

    // get all courses) from DB using Course Model
    const users = await User.find({}, { "__v": false, 'password': false }).limit(limit).skip(skip);

    res.json({ status: httpStatusText.SUCCESS, data: { users } });
})


const register = asyncWrapper(async(req, res, next) => {
    console.log(req.body);
    const { firstName, lastName, email, password } = req.body;

    // التحقق من وجود جسم في الطلب ووجود الخصائص المتوقعة
    if (!req.body || !firstName || !lastName || !email || !password) {
        const error = appError.create('Invalid request body', 400, httpStatusText.FAIL);
        return next(error);
    }

    const oldUser = await User.findOne({ email: email });

    if (oldUser) {
        const error = appError.create('User already exists', 400, httpStatusText.FAIL);
        return next(error);
    }

    // password hashing
    const hashedPassword = await bcrypt.hash(password, 10);

    const defaultAvatar = 'uploads/user.png'; // Provide the default avatar filename or URL

    const newUser = new User({
        firstName,
        lastName,
        email,
        password: hashedPassword,
        avatar: req.file ? req.file.filename : defaultAvatar,
    });

    // generate JWT token 
    const token = await generateJWT({ email: newUser.email, id: newUser._id });
    newUser.token = token;

    await newUser.save();

    res.status(201).json({ status: httpStatusText.SUCCESS, data: { user: newUser } });
});



const login = asyncWrapper(async(req, res, next) => {
    const { email, password } = req.body;

    if (!email && !password) {
        const error = appError.create('email and password are required', 400, httpStatusText.FAIL)
        return next(error);
    }

    const user = await User.findOne({ email: email });

    if (!user) {
        const error = appError.create('user not found', 400, httpStatusText.FAIL)
        return next(error);
    }

    const matchedPassword = await bcrypt.compare(password, user.password);

    if (user && matchedPassword) {
        // logged in successfully

        const token = await generateJWT({ email: user.email, id: user._id });

        // Include additional user data in the response
        const userData = {
            userName: `${user.firstName} ${user.lastName}`,
            email: user.email,
            avatar: user.avatar,
            id: user._id
        };

        return res.json({ status: httpStatusText.SUCCESS, data: { token, user: userData } });
    } else {
        const error = appError.create('something wrong', 500, httpStatusText.ERROR)
        return next(error);
    }
});


const updateUser = asyncWrapper(async(req, res, next) => {
    const userId = req.params.userId;
    const updateData = req.body;

    // Validate input data (you can customize this validation based on your needs)
    if (!userId || !updateData) {
        const error = appError.create('Invalid request', 400, httpStatusText.FAIL);
        return next(error);
    }

    try {
        // Find the user by ID
        const user = await User.findById(userId);

        if (!user) {
            const error = appError.create('User not found', 404, httpStatusText.NOT_FOUND);
            return next(error);
        }

        // Update user details
        if (updateData.firstName) user.firstName = updateData.firstName;
        if (updateData.lastName) user.lastName = updateData.lastName;
        if (updateData.email) user.email = updateData.email;

        // If you want to update the password, hash the new password
        if (updateData.password) {
            const hashedPassword = await bcrypt.hash(updateData.password, 10);
            user.password = hashedPassword;
        }

        // If you want to update the avatar, handle it accordingly
        if (req.file) {
            // Assuming you have an 'uploads' directory for storing user avatars
            user.avatar = `uploads/${req.file.filename}`;
        }

        // Save the updated user
        await user.save();

        res.json({ status: httpStatusText.SUCCESS, data: { user } });
    } catch (error) {
        console.error('Error updating user:', error);
        const appError = appError.create('Internal Server Error', 500, httpStatusText.ERROR);
        return next(appError);
    }
});

module.exports = {
    getAllUsers,
    register,
    login,
    updateUser,
}