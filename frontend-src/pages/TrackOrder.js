import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../lib/api";
import { formatDateTime, statusLabels, statusColors } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { Settings, Clock, CheckCircle, ArrowRight } from "lucide-react";

const STATUS_ORDER = [
  "received",
  "analysis",
  "awaiting_approval",
  "awaiting_part",
  "in_repair",
  "completed",
];

const TrackOrder = () => {
  const { orderNumber } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await api.get(`/track/${orderNumber}`);
        setOrder(response.data);
      } catch (err) {
        setError("Ordem de serviço não encontrada");
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderNumber]);

  const getProgress = () => {
    if (!order || order.status === "cancelled") return 0;
    const currentIndex = STATUS_ORDER.indexOf(order.status);
    if (currentIndex === -1) return 0;
    return ((currentIndex + 1) / STATUS_ORDER.length) * 100;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Settings className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-xl font-bold mb-2">OS não encontrada</h1>
            <p className="text-muted-foreground mb-4">{error}</p>
            <p className="text-sm text-muted-foreground">
              Verifique o número da OS e tente novamente
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6 py-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Settings className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">TechFix Pro</h1>
          <p className="text-muted-foreground">Acompanhamento de Ordem de Serviço</p>
        </div>

        <Card>
          <CardHeader className="text-center pb-2">
            <p className="text-sm text-muted-foreground">Número da OS</p>
            <CardTitle className="text-3xl font-mono">{order.order_number}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <Badge className={`${statusColors[order.status]} text-base px-4 py-1`}>
                {statusLabels[order.status]}
              </Badge>
            </div>

            {order.status !== "cancelled" && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progresso</span>
                  <span>{Math.round(getProgress())}%</span>
                </div>
                <Progress value={getProgress()} className="h-3" />
              </div>
            )}

            <div className="space-y-4 pt-4 border-t">
              <div>
                <p className="text-sm text-muted-foreground">Aparelho</p>
                <p className="font-medium">{order.device_info}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Defeito Relatado</p>
                <p>{order.reported_issue}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Data de Entrada</p>
                <p>{formatDateTime(order.created_at)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Histórico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {order.history?.map((entry, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className={`w-3 h-3 mt-1.5 rounded-full ${
                    index === 0 ? "bg-primary" : "bg-muted-foreground/30"
                  }`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{statusLabels[entry.status]}</p>
                      {index === 0 && <Badge variant="secondary">Atual</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(entry.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          <p>Em caso de dúvidas, entre em contato conosco</p>
        </div>
      </div>
    </div>
  );
};

export default TrackOrder;
