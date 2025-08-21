// // server/models/User.js
// const mongoose = require('mongoose');
// const bcrypt = require('bcryptjs');

// const UserSchema = new mongoose.Schema({
//   username: {
//     type: String,
//     required: [true, 'Please provide a username'],
//     unique: true,
//     trim: true,
//   },
//   password: {
//     type: String,
//     required: [true, 'Please provide a password'],
//     minlength: 6,
//     select: false,
//   },
//   geminiApiKey: { 
//     type: String,
//     required: false,
//     select: false,
//   },
//   grokApiKey: {
//     type: String,
//     required: false,
//     select: false,
//   },
//   hasProvidedApiKeys: {
//     type: Boolean,
//     default: false,
//   },
//   role: {
//     type: String,
//     enum: ['user', 'admin'],
//     default: 'user',
//   },
//   ollamaHost: {
//     type: String,
//     required: false,
//     trim: true,
//     default: null,
//   },
//   email: {
//     type: String,
//     required: [true, 'Please provide an email address'],
//     unique: true,
//     trim: true,
//   },
  
//   // ==================================================================
//   //  START OF NEW FEATURE MODIFICATIONS
//   // ==================================================================
  
//   // This new object replaces the simple 'canUseAdminKeys' boolean.
//   // It allows us to track the entire request lifecycle.
//   apiKeyAccessRequest: {
//     status: {
//       type: String,
//       enum: ['none', 'pending', 'approved', 'denied'],
//       default: 'none', // Default state for a new user
//     },
//     requestedAt: {
//       type: Date,
//       default: null,
//     },
//     processedAt: { // To track when an admin approved or denied the request
//       type: Date,
//       default: null,
//     },
//   },

//   // We are REMOVING the old 'canUseAdminKeys' field as it's now replaced
//   // by the 'apiKeyAccessRequest.status' field.
//   // canUseAdminKeys: {
//   //   type: Boolean,
//   //   default: false,
//   // },

//   // ==================================================================
//   //  END OF NEW FEATURE MODIFICATIONS
//   // ==================================================================
  
//   createdAt: {
//     type: Date,
//     default: Date.now,
//   },
// });

// // Password hashing middleware (Unchanged)
// UserSchema.pre('save', async function (next) {
//   if (!this.isModified('password')) {
//     return next();
//   }
//   try {
//     const salt = await bcrypt.genSalt(10);
//     this.password = await bcrypt.hash(this.password, salt);
//     next();
//   } catch (err) {
//     next(err);
//   }
// });

// // Method to compare password (Unchanged)
// UserSchema.methods.comparePassword = async function (candidatePassword) {
//   if (!this.password) {
//       console.error("Attempted to compare password, but password field was not loaded on the User object.");
//       throw new Error("Password field not available for comparison.");
//   }
//   return await bcrypt.compare(candidatePassword, this.password);
// };

// // Static method for login (Unchanged)
// UserSchema.statics.findByCredentials = async function(username, password) {
//     const user = await this.findOne({ username }).select('+password');
//     if (!user) {
//         console.log(`findByCredentials: User not found for username: ${username}`);
//         return null;
//     }
//     const isMatch = await user.comparePassword(password);
//     if (!isMatch) {
//         console.log(`findByCredentials: Password mismatch for username: ${username}`);
//         return null;
//     }
//     console.log(`findByCredentials: Credentials match for username: ${username}`);
//     return user;
// };


// const User = mongoose.model('User', UserSchema);

// module.exports = User;

// server/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Please provide a username'],
    unique: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 6,
    select: false,
  },
  geminiApiKey: {
    type: String,
    required: false,
    select: false,
  },
  grokApiKey: {
    type: String,
    required: false,
    select: false,
  },
  hasProvidedApiKeys: {
    type: Boolean,
    default: false,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  ollamaHost: {
    type: String,
    required: false,
    trim: true,
    default: null,
  },
  
  // ==================================================================
  //  START OF NEW FEATURE MODIFICATIONS
  // ==================================================================
  
  // This new object replaces the simple 'canUseAdminKeys' boolean.
  // It allows us to track the entire request lifecycle.
  apiKeyAccessRequest: {
    status: {
      type: String,
      enum: ['none', 'pending', 'approved', 'denied'],
      default: 'none', // Default state for a new user
    },
    requestedAt: {
      type: Date,
      default: null,
    },
    processedAt: { // To track when an admin approved or denied the request
      type: Date,
      default: null,
    },
  },

  // We are REMOVING the old 'canUseAdminKeys' field as it's now replaced
  // by the 'apiKeyAccessRequest.status' field.
  // canUseAdminKeys: {
  //   type: Boolean,
  //   default: false,
  // },

  // ==================================================================
  //  END OF NEW FEATURE MODIFICATIONS
  // ==================================================================
  
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Password hashing middleware (Unchanged)
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Method to compare password (Unchanged)
UserSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) {
      console.error("Attempted to compare password, but password field was not loaded on the User object.");
      throw new Error("Password field not available for comparison.");
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

// Static method for login (Unchanged)
UserSchema.statics.findByCredentials = async function(username, password) {
    const user = await this.findOne({ username }).select('+password');
    if (!user) {
        console.log(`findByCredentials: User not found for username: ${username}`);
        return null;
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
        console.log(`findByCredentials: Password mismatch for username: ${username}`);
        return null;
    }
    console.log(`findByCredentials: Credentials match for username: ${username}`);
    return user;
};


const User = mongoose.model('User', UserSchema);

module.exports = User;