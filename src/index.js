import './styles/style.css';
import { COMPETITIONS } from './data/competitions';
import { App } from './core/App';

// Initialize the application
const app = new App();
window.app = app; // For debugging if needed

// Start the app
app.render();
