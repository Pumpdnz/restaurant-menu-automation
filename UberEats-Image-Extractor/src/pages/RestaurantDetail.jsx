import React from 'react';
import { useParams } from 'react-router-dom';

export default function RestaurantDetail() {
  const { id } = useParams();
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Restaurant Detail</h1>
      <p className="mt-1 text-sm text-gray-500">Restaurant ID: {id}</p>
    </div>
  );
}
