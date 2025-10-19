# Start with a Python 3.9 image, which includes build tools
FROM python:3.9

# Set the working directory in the container
WORKDIR /app

# Install Node.js v18 and essential build tools
# --- THIS IS THE KEY CHANGE ---
# Added 'libgl1-mesa-glx' which is required by the opencv-python library.
RUN apt-get update && apt-get install -y nodejs cmake build-essential libgl1-mesa-glx

# Copy Python requirements file first, to leverage Docker cache
COPY requirements.txt .
# Install Python packages
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