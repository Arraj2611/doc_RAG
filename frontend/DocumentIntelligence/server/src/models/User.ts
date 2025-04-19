import mongoose, { Document } from 'mongoose';

export interface IUser extends Document {
    username: string;
    password: string;
    email?: string;
    displayName?: string;
    createdAt: Date;
}

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
    },
    displayName: {
        type: String,
        trim: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

export const User = mongoose.model<IUser>('User', userSchema);
export default User; 