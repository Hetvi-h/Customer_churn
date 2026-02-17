import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import CustomerIntelligence from './pages/CustomerIntelligence';
import Segments from './pages/Segments';
import Trends from './pages/Trends';
import FeatureDrivers from './pages/FeatureDrivers';
import ModelMetrics from './pages/ModelMetrics';
import UploadData from './pages/UploadData';
import { UploadProvider } from './contexts/UploadContext';

function App() {
  return (
    <BrowserRouter>
      <UploadProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/upload" element={<UploadData />} />
            <Route path="/customers" element={<CustomerIntelligence />} />
            <Route path="/segments" element={<Segments />} />
            <Route path="/trends" element={<Trends />} />
            <Route path="/features" element={<FeatureDrivers />} />
            <Route path="/model-metrics" element={<ModelMetrics />} />
          </Routes>
        </Layout>
      </UploadProvider>
    </BrowserRouter>
  );
}

export default App;
