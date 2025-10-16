# Start with a Python 3.9 image, which includes build tools
FROM python:3.9

# Set the working directory in the container
WORKDIR /app

# Install Node.js v18 and essential build tools
# --- THIS IS THE KEY CHANGE ---
# We are now also installing python3-dlib, which is pre-compiled and much faster.
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
RUN apt-get update && apt-get install -y nodejs cmake build-essential python3-dlib

# Copy Python requirements file first, to leverage Docker cache
COPY requirements.txt .
# Install Python packages. Pip will see that dlib is already installed and skip the slow build.
RUN pip install --no-cache-dir -r requirements.txt

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