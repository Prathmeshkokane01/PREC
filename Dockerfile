# Start with the official Python 3.9 image
FROM python:3.9

# Set the working directory
WORKDIR /app

# Install all system dependencies in a single step, including Node.js 18
RUN apt-get update && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs cmake build-essential libgl1 && \
    rm -rf /var/lib/apt/lists/*

# Copy dependency files
COPY requirements.txt .
COPY package*.json ./

# --- THIS IS THE KEY CHANGE ---
# Install dlib separately first. Pip will prioritize finding a pre-compiled wheel,
# which is much faster and uses less memory than compiling from source.
RUN pip install --no-cache-dir dlib

# Now, install the rest of the Python and Node.js dependencies.
# Pip will see that dlib is already installed and will skip it.
RUN pip install --no-cache-dir -r requirements.txt
RUN npm install

# Copy the rest of the application source code
COPY . .

# Expose the application port
EXPOSE 3000

# Command to start the server
CMD [ "node", "server.js" ]