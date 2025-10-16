# Start from a base image that already has Python, dlib, and face_recognition installed
FROM ageitgey/face_recognition:latest

# Set the working directory
WORKDIR /app

# The base image uses Python 3.6, but we can install Node.js v18
# This also updates the system and installs build tools for Node.js
RUN apt-get update && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs build-essential

# Copy your Python requirements. face_recognition and dlib will be skipped as they are in the base image.
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy Node.js package files
COPY package*.json ./
# Install Node.js packages
RUN npm install

# Copy the rest of your application's source code
COPY . .

# Expose the port your app runs on
EXPOSE 3000

# The command to start your server
CMD [ "node", "server.js" ]