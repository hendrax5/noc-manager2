FROM node:24-alpine

WORKDIR /app

# Install necessary dependencies for Prisma
RUN apk add --no-cache openssl python3 make g++

# Only copy package.json initially to cache the install step if unchanged
COPY package.json ./

# Install dependencies (will generate package-lock.json)
RUN npm install

# Copy everything else
COPY . .

# Generate Prisma client based on the local schema.prisma
RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "dev"]
