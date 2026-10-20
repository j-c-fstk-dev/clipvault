# Contributing to ClipVault 🤝

Thank you for your interest in contributing to ClipVault! We're excited to have you join our community of developers working to create the best clipboard manager experience.

## 🚀 Getting Started

### Prerequisites
- [Rust](https://rustup.rs/) (stable)
- Node.js 20+ and npm
- Git for version control
- Tauri system libraries (Debian / Ubuntu / Kali):
  ```bash
  sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
    librsvg2-dev libxdo-dev libssl-dev build-essential curl wget file patchelf
  ```

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/<your-user>/clipvault.git
   cd clipvault
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Run the Desktop App**
   ```bash
   npm run tauri dev
   ```

4. **Run the Checks Before Opening a PR**
   ```bash
   npm run lint && npm run build
   cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
   ```

## 📋 How to Contribute

### 1. Choose an Issue
- Browse [open issues](https://github.com/j-c-fstk-dev/clipvault/issues)
- Look for issues labeled `good first issue` for beginners
- Comment on the issue to let others know you're working on it

### 2. Create a Branch
```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### 3. Make Your Changes
- Follow our coding standards (see below)
- Write clear, concise commit messages
- Test your changes thoroughly

### 4. Submit a Pull Request
- Push your branch to your fork
- Create a pull request with a clear description
- Link any related issues
- Wait for review and feedback

## 🎯 Areas for Contribution

### 🐛 Bug Fixes
- Fix reported issues
- Improve error handling
- Enhance stability

### ✨ New Features
- Implement roadmap items
- Add user-requested features
- Enhance existing functionality

### 🎨 UI/UX Improvements
- Improve visual design
- Enhance user experience
- Add animations and transitions

### 📚 Documentation
- Improve README
- Add code comments
- Create tutorials and guides

### 🔧 Performance
- Optimize rendering
- Reduce bundle size
- Improve memory usage

## 📝 Coding Standards

### TypeScript
- Use strict TypeScript configuration
- Define proper types for all data structures
- Avoid `any` types when possible
- Use meaningful variable and function names

### React Components
- Use functional components with hooks
- Follow the single responsibility principle
- Keep components small and focused
- Use proper prop types

### Styling
- Use Tailwind CSS classes
- Follow the 8px spacing system
- Maintain consistent color usage
- Ensure responsive design

### File Organization
- Keep files under 300 lines
- Use clear, descriptive file names
- Group related functionality
- Follow the existing folder structure

## 🧪 Testing

### Before Submitting
- Test your changes in both light and dark themes
- Verify responsive design on different screen sizes
- Check all interactive elements work correctly
- Ensure no console errors or warnings

### Manual Testing Checklist
- [ ] All existing features still work
- [ ] New features work as expected
- [ ] UI looks good in both themes
- [ ] No performance regressions
- [ ] Responsive design works properly

## 📖 Commit Guidelines

### Commit Message Format
```
type(scope): description

[optional body]

[optional footer]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples
```bash
feat(clipboard): add support for image thumbnails
fix(settings): resolve theme switching bug
docs(readme): update installation instructions
style(components): improve code formatting
```

## 🎨 Design Guidelines

### Visual Consistency
- Follow the existing design system
- Use consistent spacing (8px grid)
- Maintain proper contrast ratios
- Ensure accessibility standards

### Color Usage
- Use the defined accent color system
- Maintain theme consistency
- Test in both light and dark modes
- Consider colorblind accessibility

### Typography
- Use consistent font weights
- Maintain proper line heights
- Ensure readable font sizes
- Follow the typography scale

## 🔍 Code Review Process

### What We Look For
- **Functionality**: Does the code work as intended?
- **Quality**: Is the code clean and well-structured?
- **Performance**: Are there any performance implications?
- **Design**: Does it match our design standards?
- **Testing**: Has it been properly tested?

### Review Timeline
- Initial review within 48 hours
- Follow-up reviews within 24 hours
- Merge after approval from maintainers

## 🆘 Getting Help

### Communication Channels
- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Pull Request Comments**: For code-specific questions

### Questions?
Don't hesitate to ask! We're here to help:
- Comment on issues or pull requests
- Start a discussion
- Reach out to maintainers

## 🏆 Recognition

### Contributors
All contributors will be:
- Listed in our README
- Credited in release notes
- Invited to our contributors' channel

### Maintainers
Active contributors may be invited to become maintainers with:
- Commit access to the repository
- Ability to review and merge pull requests
- Input on project direction

## ⚖️ Licensing of Contributions

ClipVault is licensed under the [AGPL-3.0](LICENSE). The project may also be
offered under a commercial license in the future, so contributions require
agreeing to a Contributor License Agreement (CLA) that allows the maintainer
to relicense them. The CLA process will be set up before external
contributions are merged.

## 📜 Code of Conduct

### Our Pledge
We are committed to making participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards
- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Respect different viewpoints and experiences

### Enforcement
Instances of abusive, harassing, or otherwise unacceptable behavior may be reported to the project maintainers. All complaints will be reviewed and investigated promptly and fairly.

---

## 🎉 Thank You!

Thank you for contributing to ClipVault! Your efforts help make this project better for everyone. We appreciate your time, skills, and dedication to improving the clipboard management experience.

**Happy coding!** 🧠✨