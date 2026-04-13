import mongoose from '../../../../app/src/infrastructure/Mongoose.mjs'

const { Schema } = mongoose
const { ObjectId } = Schema

const UserGoogleDriveAuthSchema = new Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true, unique: true, index: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String },
    expiresAt: { type: Date },
    email: { type: String }, // Google account email
    scope: { type: String },
    tokenType: { type: String, default: 'Bearer' },
    connectedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: 'userGoogleDriveAuth',
  }
)

// Index for finding active connections
UserGoogleDriveAuthSchema.index({ userId: 1, isActive: 1 })

const UserGoogleDriveAuth = mongoose.model('UserGoogleDriveAuth', UserGoogleDriveAuthSchema)

export { UserGoogleDriveAuth, UserGoogleDriveAuthSchema }
export default UserGoogleDriveAuth
