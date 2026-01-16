import { BrowserRouter as Routerz_Hehe, Routes, Route, Link } from 'react-router-dom';
import { useState } from 'react'
import Home from './pages/Home';
import Navbar from './components/navbar';
import './App.css'
import Auth from './pages/Auth';
import Upload from './pages/Uploads';
import Leaderboard from './pages/Leaderboard';
import Audit from './pages/Audit';

function App() {

  return (
    <>
      <Routerz_Hehe >

        <header className="">
          <Navbar />
        </header>
        <Routes className='mt-16'>
          <Route path='/' element={<Upload />} />
          <Route path='/audit' element={<Audit />} />
          <Route path='/leaderboard' element={<Leaderboard />} />
          <Route path='*' element={<div className='text-center text-gray-600'>404</div>} />
        </Routes>

      </Routerz_Hehe>
    </>
  )
}

export default App
