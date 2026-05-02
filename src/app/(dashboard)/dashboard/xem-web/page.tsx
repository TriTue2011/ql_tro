'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Globe, ExternalLink, RefreshCw, Home, AlertCircle, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function XemWebPage() {
  const [url, setUrl] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  useEffect(() => {
    document.title = 'Xem Web - Dashboard';
  }, []);

  const handleLoadUrl = () => {
    if (!url) return;
    
    let formattedUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      formattedUrl = 'https://' + url;
    }
    
    setIsLoading(true);
    setLoadError(false);
    setIframeLoaded(false);
    setCurrentUrl(formattedUrl);
    
    // Set timeout to detect loading issues
    setTimeout(() => {
      if (!iframeLoaded) {
        setLoadError(true);
        setIsLoading(false);
      }
    }, 10000); // 10 seconds timeout
  };

  const handleRefresh = () => {
    if (currentUrl) {
      setIsLoading(true);
      setLoadError(false);
      setIframeLoaded(false);
      // Force refresh iframe
      const iframe = document.getElementById('web-iframe') as HTMLIFrameElement;
      if (iframe) {
        iframe.src = currentUrl;
      }
      setTimeout(() => {
        if (!iframeLoaded) {
          setLoadError(true);
          setIsLoading(false);
        }
      }, 10000);
    }
  };

  const handleReset = () => {
    setUrl('');
    setCurrentUrl('');
    setLoadError(false);
    setIframeLoaded(false);
  };

  const handleIframeLoad = () => {
    setIframeLoaded(true);
    setIsLoading(false);
    setLoadError(false);
  };

  const handleIframeError = () => {
    setLoadError(true);
    setIsLoading(false);
    setIframeLoaded(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLoadUrl();
    }
  };

  const quickLinks = [
    { name: 'Wikipedia', url: 'https://vi.wikipedia.org' },
    { name: 'VNExpress', url: 'https://vnexpress.net' },
    { name: 'Dân Trí', url: 'https://dantri.com.vn' },
    { name: 'Example.com', url: 'https://example.com' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
          <Globe className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-indigo-900">Xem Web</h1>
          <p className="text-sm text-indigo-600">Nhập link để xem website ngay trên trang quản lý</p>
        </div>
      </div>

      {/* URL Input Card */}
      <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
        <div className="p-4 md:p-6 border-b border-indigo-100">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-indigo-900">Nhập địa chỉ website</h3>
              <p className="text-sm text-indigo-600">
                Nhập URL của trang web bạn muốn xem (VD: google.com, facebook.com)
              </p>
            </div>
          </div>
        </div>
        <div className="p-4 md:p-6 space-y-4">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Nhập URL (VD: google.com hoặc https://google.com)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
            />
            <Button
              onClick={handleLoadUrl}
              disabled={!url || isLoading}
              className="bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-0 shadow-md shadow-indigo-200"
            >
              <Globe className="h-4 w-4 mr-2" />
              Tải trang
            </Button>
          </div>

          {/* Quick Links */}
          <div className="space-y-2">
            <p className="text-sm text-indigo-600">Truy cập nhanh:</p>
            <div className="flex flex-wrap gap-2">
              {quickLinks.map((link) => (
                <Button
                  key={link.name}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setUrl(link.url);
                    setCurrentUrl(link.url);
                  }}
                  className="border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                >
                  {link.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Control Buttons */}
          {currentUrl && (
            <div className="flex items-center gap-2 pt-2 border-t border-indigo-100">
              <Badge variant="outline" className="flex items-center gap-1 text-xs border-indigo-200 text-indigo-600 bg-indigo-50">
                <Globe className="h-3 w-3" />
                {currentUrl}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
                className="text-indigo-600 hover:bg-indigo-50"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-indigo-600 hover:bg-indigo-50"
              >
                <Home className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(currentUrl, '_blank')}
                className="text-indigo-600 hover:bg-indigo-50"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Error Alert - CSP/X-Frame-Options Violation */}
      {currentUrl && loadError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>❌ Không thể tải trang web trong iframe</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              Trang web <strong className="break-all">{currentUrl}</strong> đã chặn việc hiển thị trong iframe.
            </p>
            
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm space-y-2">
              <p className="font-semibold text-red-900">🔒 Lý do bảo mật:</p>
              <ul className="list-disc list-inside space-y-1 text-red-800">
                <li><strong>X-Frame-Options</strong>: Ngăn chặn clickjacking</li>
                <li><strong>Content Security Policy (CSP)</strong>: Giới hạn nguồn nhúng</li>
              </ul>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
              <p className="font-semibold text-yellow-900 mb-1">🚫 Các trang web thường bị chặn:</p>
              <p className="text-yellow-800">
                Google, YouTube, Facebook, Instagram, Twitter, Banking apps, AppSheet, 
                Gmail, LinkedIn, và hầu hết các trang đăng nhập/thanh toán.
              </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded p-3 text-sm">
              <p className="font-semibold text-green-900 mb-1">✅ Các trang có thể dùng:</p>
              <p className="text-green-800">
                Wikipedia, các trang tin tức (VNExpress, Dân Trí), blog cá nhân, 
                tài liệu công khai, và các trang cho phép nhúng.
              </p>
            </div>
            
            <div className="flex gap-2 mt-4">
              <Button
                size="sm"
                onClick={() => window.open(currentUrl, '_blank')}
                className="bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-0 shadow-md shadow-indigo-200"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Mở trong tab mới
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="border-indigo-200 text-indigo-600 hover:bg-indigo-50"
              >
                <Home className="h-4 w-4 mr-2" />
                Thử trang khác
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Success Indicator */}
      {currentUrl && iframeLoaded && !loadError && (
        <Alert className="border-indigo-200 bg-indigo-50">
          <CheckCircle className="h-4 w-4 text-indigo-600" />
          <AlertTitle className="text-indigo-900">Đã tải thành công</AlertTitle>
          <AlertDescription className="text-indigo-800">
            Trang web đang hiển thị bên dưới. Bạn có thể tương tác trực tiếp với trang web.
          </AlertDescription>
        </Alert>
      )}

      {/* Iframe Display */}
      {currentUrl && !loadError && (
        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50 overflow-hidden">
          <div className="relative w-full" style={{ height: 'calc(100vh - 500px)', minHeight: '600px' }}>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-indigo-50/80 z-10">
                <div className="text-center">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-indigo-400" />
                  <p className="text-sm text-indigo-600">Đang tải trang...</p>
                  <p className="text-xs text-indigo-500 mt-2">Nếu không tải được sau 10 giây, trang web có thể chặn iframe</p>
                </div>
              </div>
            )}
            <iframe
              id="web-iframe"
              src={currentUrl}
              className="w-full h-full border-0"
              title="Web Viewer"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
            />
          </div>
        </div>
      )}

      {/* Empty State */}
      {!currentUrl && (
        <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-white/40 p-16 text-center">
          <div className="text-center space-y-4">
            <Globe className="h-16 w-16 mx-auto text-indigo-300" />
            <div>
              <h3 className="text-lg font-semibold text-indigo-900">Chưa có trang web nào được tải</h3>
              <p className="text-sm text-indigo-600 mt-2">
                Nhập địa chỉ website ở trên hoặc chọn một liên kết nhanh để bắt đầu
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info Card */}
      <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
        <div className="p-4 md:p-6">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
              <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1 space-y-2">
              <h4 className="text-sm font-semibold text-indigo-900">📌 Hướng dẫn sử dụng</h4>
              <div className="text-sm text-indigo-700 space-y-2">
                <p>
                  <strong>Cơ chế bảo mật iframe:</strong> Nhiều trang web sử dụng <code className="bg-indigo-100 px-1 rounded text-indigo-800">X-Frame-Options</code>
                  hoặc <code className="bg-indigo-100 px-1 rounded text-indigo-800">Content-Security-Policy</code> để ngăn chặn việc nhúng vào iframe,
                  bảo vệ người dùng khỏi các cuộc tấn công clickjacking.
                </p>
                <p>
                  <strong>Giải pháp:</strong> Nếu trang web bị chặn, sử dụng nút <strong>"Mở trong tab mới"</strong> để
                  xem trang web trong cửa sổ riêng biệt.
                </p>
                <p>
                  <strong>Mẹo:</strong> Các trang tin tức, Wikipedia, tài liệu công khai thường cho phép nhúng iframe.
                  Các trang mạng xã hội, banking, email thường bị chặn.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

