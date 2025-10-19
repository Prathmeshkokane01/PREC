# Start with the official Python 3.9 image
FROM python:3.9

# Set the working directory
WORKDIR /app

# Install all system dependencies in a single step, including Node.js 18
RUN apt-get update && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs cmake build-essential libgl1 && \
    rm -rf /var/lib/apt/lists/*

# Copy dependency files first to leverage Docker's layer cache
COPY requirements.txt .
COPY package*.json ./

# Install Python and Node.js dependencies
RUN pip install --no-cache-dir -r requirements.txt
RUN npm install

# Copy the rest of the application source code
COPY . .

# Expose the application port
EXPOSE 3000

# Command to start the server
CMD [ "node", "server.js" ]