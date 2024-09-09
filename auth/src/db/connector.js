import mongoose from 'mongoose' ;

const connectToMongoDB = async ()=>{
    try {
		await mongoose.connect(process.env.MONGO_URI );
		console.log("Connected to MongoDB for Auth service");
	} catch (error) {
		console.error("Error connecting to MongoDB");
	}
}

export default connectToMongoDB;