import ErrorBoundary from "./components/ErrorBoundary";
import GameCanvas from "./components/GameCanvas";

// Salt-Scoured Field Manual: the browser frame is deliberately absent so the route map owns every pixel.

function App() {
  return (
    <ErrorBoundary>
      <GameCanvas />
    </ErrorBoundary>
  );
}

export default App;
