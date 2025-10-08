# Stage 1: Use a Python image to install AI libraries
FROM python:3.9

# Install system dependencies needed to build dlib
RUN apt-get update && apt-get install -y cmake build-essential

WORKDIR /app

# Copy the requirements file and install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Stage 2: Use a Node.js image for the main application
FROM node:18-slim

# Install the build tools needed for Node.js packages like bcrypt
RUN apt-get update && apt-get install -y python3 make g++

WORKDIR /app

# Copy Node.js project files
COPY package*.json ./
RUN npm install

# Copy the rest of your application code
COPY . .

# Copy the pre-installed Python libraries from the first stage (stage 0)
COPY --from=0 /usr/local/lib/python3.9/site-packages /usr/local/lib/python3.9/site-packages

# Expose the port your application runs on
EXPOSE 3000

# Command to start your server
CMD [ "node", "server.js" ]