import React from 'react';
import { Header as HeaderBasic } from '../basic/Header';

interface HeaderProps {
  className?: string;
}

const Header: React.FC<HeaderProps> = ({ className = '' }) => {
  return <HeaderBasic className={className} />;
};

export default Header;
