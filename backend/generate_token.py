import jwt
import datetime
import os
import argparse

# Load secret and algorithm from environment variables or use defaults
JWT_SECRET = os.getenv("JWT_SECRET", "4nZ#Gv!mTq@9xLp$2uYwRb7*AeJ6")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
DEFAULT_EXPIRATION_DAYS = 30

def create_jwt(user_id: str, expiration_days: int = DEFAULT_EXPIRATION_DAYS) -> str:
    """Creates a JWT token for a given user ID."""
    expiration_time = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=expiration_days)
    
    payload = {
        "user_id": user_id,
        "exp": expiration_time,
        "iat": datetime.datetime.now(datetime.timezone.utc) # Issued at time
    }
    
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return token

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate a JWT token.")
    parser.add_argument("user_id", help="The user ID to include in the token.")
    parser.add_argument("-e", "--expires", type=int, default=DEFAULT_EXPIRATION_DAYS, 
                        help=f"Token expiration in days (default: {DEFAULT_EXPIRATION_DAYS})")
    parser.add_argument("-o", "--output", help="Optional file path to save the token.")

    args = parser.parse_args()

    generated_token = create_jwt(args.user_id, args.expires)
    
    print(f"Generated Token for user '{args.user_id}':\n{generated_token}")

    if args.output:
        try:
            with open(args.output, 'w') as f:
                f.write(generated_token)
            print(f"Token saved to: {args.output}")
        except IOError as e:
            print(f"Error saving token to file: {e}") 