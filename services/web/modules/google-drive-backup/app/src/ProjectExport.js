const mongoose = require('../../../../app/src/infrastructure/Mongoose')

const { Schema } = mongoose
const { ObjectId } = Schema

const ProjectExportSchema = new Schema(
  {
    projectId: { type: ObjectId, ref: 'Project', required: true, index: true },
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    driveFileId: { type: String, required: true },
    driveFolderId: { type: String },
    driveFileName: { type: String },
    driveFileUrl: { type: String }, // Direct link to file in Drive
    exportedAt: { type: Date, default: Date.now, index: true },
    fileSize: { type: Number },
    projectVersion: { type: Number },
    projectName: { type: String },
  },
  {
    timestamps: true,
    collection: 'projectExports',
  }
)

// Index for finding latest export per project/user
ProjectExportSchema.index({ projectId: 1, userId: 1, exportedAt: -1 })

const ProjectExport = mongoose.model('ProjectExport', ProjectExportSchema)

module.exports = {
  ProjectExport,
  ProjectExportSchema,
}
