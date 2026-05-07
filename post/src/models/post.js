import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },

    title: {
      type: String,
      required: true,
      trim: true
    },

    content: {
      type: String,
      required: true
    },

    image: {
      type: String,
      default: ""
    },

    likes: [
      {
        type: mongoose.Schema.Types.ObjectId
      }
    ]

  },
  {
    timestamps: true
  }
);

const Post = mongoose.model("Post", postSchema);

export default Post;