import mongoose from "mongoose";

const dbConnection = async () => {
  mongoose
    .connect(process.env.DB_URL_Online)
    .then(() => {
      console.log("DB connected");
    })
    .catch((err) => {
      console.log(err);
      console.log("failed to connected DB");
    });
};
export default dbConnection;
