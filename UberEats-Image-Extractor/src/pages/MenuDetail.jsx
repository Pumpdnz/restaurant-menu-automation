import React from 'react';
import { useParams } from 'react-router-dom';

export default function MenuDetail() {
  const { id } = useParams();
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Menu Detail</h1>
      <p className="mt-1 text-sm text-gray-500">Menu ID: {id}</p>
    </div>
  );
}
