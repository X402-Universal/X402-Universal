# validator-service/validator-service/README.md

# Validator Service

This project is a simple Express server designed to handle validation requests. It is structured to separate concerns into routes, controllers, middlewares, services, and utilities.

## Project Structure

- **src/**
  - **app.ts**: Initializes the Express application and sets up middleware.
  - **server.ts**: Entry point for starting the server.
  - **routes/**
    - **index.ts**: Sets up the application routes.
  - **controllers/**
    - **index.ts**: Contains business logic for handling requests.
  - **middlewares/**
    - **index.ts**: Middleware functions for request and response handling.
  - **services/**
    - **index.ts**: Core logic for interacting with external APIs or databases.
  - **utils/**
    - **index.ts**: Utility functions for common tasks.

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   ```

2. Navigate to the project directory:
   ```
   cd validator-service
   ```

3. Install the dependencies:
   ```
   npm install
   ```

## Usage

To start the server, run:
```
npm start
```

The server will listen on the specified port defined in `src/server.ts`.

## Contributing

Feel free to submit issues or pull requests for improvements or bug fixes. 

## License

This project is licensed under the MIT License.


# TO DEPLOY
git subtree push --prefix validator-service validator-service main