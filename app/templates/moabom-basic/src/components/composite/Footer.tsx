import React from 'react';
import { Footer as FooterBasic } from '../basic/Footer';

interface FooterProps {
  className?: string;
}

const Footer: React.FC<FooterProps> = ({ className = '' }) => {
  return <FooterBasic className={className} />;
};

export default Footer;
