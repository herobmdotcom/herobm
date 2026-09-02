import sys

def main():
    if "--force" in sys.argv or "-y" in sys.argv:
        sys.exit(0)
    
    prompt = sys.argv[1] if len(sys.argv) > 1 else "Are you sure you want to proceed?"
    try:
        response = input(f"{prompt} [y/N]: ").strip().lower()
        if response in ("y", "yes"):
            sys.exit(0)
        else:
            print("Operation cancelled.")
            sys.exit(1)
    except (KeyboardInterrupt, EOFError):
        print("\nOperation cancelled.")
        sys.exit(1)

if __name__ == "__main__":
    main()
